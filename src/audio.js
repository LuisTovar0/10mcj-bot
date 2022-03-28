import fs from "fs";

export function saveAudio(bot, msg, fileName, callback) {
  bot.fileLoad(msg.file, (err, buffer) => {
    if (err) throw err;
    let stream = fs.createWriteStream(fileName);
    stream.on('close', async (err) => {
      if (err) throw new Error('Failed creating audio file');
      await callback();
    });
    stream.end(buffer);
  });
}
