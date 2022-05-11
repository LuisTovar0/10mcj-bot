import fs from "fs";
import BotError from "./botError";
import {Bot, Msg} from "./declarations";

export function saveFile(bot: Bot, msg: Msg, fileName: fs.PathLike, callback: () => Promise<void>) {
  bot.fileLoad(msg.file, (err: any, buffer: any) => {
    if (err) throw err;
    let stream = fs.createWriteStream(fileName);
    stream.on('close', async (err: any) => {
      if (err) {
        console.log(err);
        throw new BotError(`Failed creating ${fileName}`);
      }
      await callback();
    });
    stream.end(buffer);
  });
}
