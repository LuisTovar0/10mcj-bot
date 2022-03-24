import fs from "fs";

export function saveAudio(bot, msg, fileName, eventEmitter) {
  bot.fileLoad(msg.file, (err, buffer) => {
    if (err) throw err;
    let stream = fs.createWriteStream(fileName);
    stream.on('close', (err) => {
      if (err) throw new Error('Failed creating audio file');
      eventEmitter.emit("downloaded audio " + msg.chat.id);
    });
    stream.end(buffer);
  });
}
