import fs from "fs";

export function saveAudio(bot, file, fileName, eventEmitter) {
  bot.fileLoad(file, (err, buffer) => {
    if (err) throw err;
    let stream = fs.createWriteStream(fileName);
    stream.on('close', (err) => {
      if (err) throw new Error('Failed creating audio file');
      eventEmitter.emit('downloaded audio');
    });
    stream.end(buffer);
  });
}
