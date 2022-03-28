import fs from "fs";
import BotError from "./botError.js";

export function saveFile(bot, msg, fileName, callback) {
  bot.fileLoad(msg.file, (err, buffer) => {
    if (err) throw err;
    let stream = fs.createWriteStream(fileName);
    stream.on('close', async (err) => {
      if (err) {
        console.log(err);
        throw new BotError(`Failed creating ${fileName}`);
      }
      await callback();
    });
    stream.end(buffer);
  });
}
