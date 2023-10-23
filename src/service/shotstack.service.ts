import axios from "axios";
import fs from "fs";
import fetch from "node-fetch-commonjs";
import {Subject} from "rxjs";
import {Service} from "typedi";
import {loadEnvVar} from "../config";
import {tempFolder} from "../config/constants";
import IVideoService, {VideoCreation$} from "./iService/i-video.service";

@Service()
export default class ShotstackService implements IVideoService {

  createVideo(image: string) {
    const ret = new Subject<VideoCreation$>();

    this.asyncCreateVideo(ret, image);

    return ret.asObservable();
  }

  async asyncCreateVideo(rxjsSubject: Subject<VideoCreation$>, image: string) {
    const fileStackResp = await fetch(`https://www.filestackapi.com/api/store/S3?key=${loadEnvVar('filestackApiKey')}`, {
      method: 'POST', body: fs.createReadStream(image), headers: {
        accept: 'application/json', 'Content-Type': 'image/jpg',
      },
    });

    const imageUrl = (await fileStackResp.json() as any).url;

    const a = {
      output: {
        format: "mp4",
        resolution: "sd",
      },
      timeline: {
        soundtrack: {
          src: "https://s3-ap-southeast-2.amazonaws.com/shotstack-assets/music/moment.mp3",
          effect: "fadeOut",
        },
        background: "#000000",
        tracks: [
          {
            clips: [
              {
                asset: { type: "video", src: "https://cdn.filestackcontent.com/39L7KvQQRHWH329SppZw" },
                start: 0,
                length: 10,
                transition: { out: "fade" },
              },
              {
                asset: { type: "image", src: imageUrl },
                start: 9,
                length: 20,
                transition: { in: "fade" },
              },
            ],
          },
        ],
      },
    };

    const shotstackApiKey = loadEnvVar('shotstackApiKey');
    const renderResp = await axios.post("https://api.shotstack.io/edit/stage/render", a,
        { headers: { "x-api-key": shotstackApiKey } });
    const id = renderResp.data.response.id;
    let done = false;
    let url: string | undefined = undefined;
    const fileName = `${tempFolder}/${new Date().getTime()}.mp4`;
    while (!done) {
      const statusResp = await axios.get(`https://api.shotstack.io/edit/stage/render/${id}`,
          { headers: { "x-api-key": shotstackApiKey } });
      console.log(statusResp.data.response.status);
      if (statusResp.data.response.status === 'done') {
        done = true;
        url = statusResp.data.response.url;
      }
      if (!done)
        await new Promise(r => setTimeout(r, 2_000));
    }
    if (url) {
      const file = await axios.get(url, { responseType: 'stream' });
      const writer = fs.createWriteStream(fileName);
      file.data.pipe(writer);
    }

  }

}
