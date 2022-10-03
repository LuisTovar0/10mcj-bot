import fs from "fs";
import BotError from "./botError";
import {Bot} from "./types/botgram";
import {messageAudio} from "./types/model";

export function saveFile(bot: Bot, msg: messageAudio, fileName: fs.PathLike): Promise<void> {
  return new Promise(resolve => {
    bot.fileLoad(msg.file, (err: any, buffer: any) => {
      if (err) throw err;
      let stream = fs.createWriteStream(fileName);
      stream.on('close', async (err: any) => {
        if (err) {
          console.log(err);
          throw new BotError(`Failed creating ${fileName}`);
        }
        resolve();
      });
      stream.end(buffer);
    });
  });
}
