import { createWriteStream, openAsBlob } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Subject } from "rxjs";
import { Service } from "typedi";
import { loadEnvVar } from "../config";
import { tempFolder } from "../config/constants";
import { fetchChecked } from "./fetch-checked";
import IVideoService, { VideoCreation$ } from "./i-service/i-video.service";

@Service()
export default class ShotstackService implements IVideoService {

  createVideo(image: string) {
    const ret = new Subject<VideoCreation$>();

    this.asyncCreateVideo(ret, image);

    return ret.asObservable();
  }

  async asyncCreateVideo(rxjsSubject: Subject<VideoCreation$>, image: string) {
    const uploadUrl = new URL('https://www.filestackapi.com/api/store/S3');
    uploadUrl.searchParams.set('key', loadEnvVar('filestackApiKey'));
    const uploadResponse = await fetchChecked(uploadUrl, 'Filestack upload', {
      method: 'POST',
      headers: { accept: 'application/json', 'Content-Type': 'image/jpg' },
      body: await openAsBlob(image),
    });
    const { url: imageUrl } = await uploadResponse.json() as { url: string };

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

    const renderUrl = 'https://api.shotstack.io/edit/stage/render';
    const headers = { 'x-api-key': loadEnvVar('shotstackApiKey') };
    const renderResponse = await fetchChecked(renderUrl, 'Shotstack render', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    });
    const { response: { id } } = await renderResponse.json() as { response: { id: string } };
    let done = false;
    let url: string | undefined = undefined;
    const fileName = `${ tempFolder }/${ new Date().getTime() }.mp4`;
    while (!done) {
      const statusResponse = await fetchChecked(`${ renderUrl }/${ id }`, 'Shotstack render status', { headers });
      const { response } = await statusResponse.json() as { response: { status: string; url?: string } };
      console.log(response.status);
      if (response.status === 'done') {
        done = true;
        url = response.url;
      }
      if (!done)
        await new Promise(r => setTimeout(r, 2_000));
    }
    if (url) {
      const file = await fetchChecked(url, 'Shotstack video download');
      if (!file.body) throw new Error('Shotstack returned no video data.');
      await pipeline(Readable.fromWeb(file.body), createWriteStream(fileName));
    }

  }

}
