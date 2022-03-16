import fs from "fs";
import MP3Tag from 'mp3tag.js';

export function saveAudio(bot, file, fileName, eventEmitter) {
  bot.fileLoad(file, (err, buffer) => {
    if (err) throw err;
    let stream = fs.createWriteStream(fileName);
    stream.on('close', (err) => {
      if (err) throw new Error('Failed creating audio file');
      eventEmitter.emit('finished');
    });
    stream.end(buffer);
  });
}

export function editAudioProps(filename, title, date) {
  const buffer = fs.readFileSync(filename);
  const mp3tag = new MP3Tag(buffer, true);
  mp3tag.read({id3v1: true, id3v2: true});
  if (mp3tag.error !== '') throw new Error(mp3tag.error);

  mp3tag.tags.title = title;
  mp3tag.tags.artist = date;
  mp3tag.tags.album = '10 Minutos com Jesus';

  mp3tag.save({id3v1: {include: true}, id3v2: {include: false}});
  if (mp3tag.error !== '') throw new Error(mp3tag.error);

  mp3tag.read();
  console.log(mp3tag.tags);
}
