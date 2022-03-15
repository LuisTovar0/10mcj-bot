import fs from "fs";

export default (bot, msg) => {
  const dirname = msg.chat.id.toString();
  createDir(dirname);

  bot.fileLoad(msg.file, (err, buffer) => {
    if (err) throw err;
    let stream = fs.createWriteStream('./' + dirname + '/abc.mp3');
    stream.write(buffer);
  });
}

export function createDir(name) {
  fs.access(name, (notExists) => {
    if (notExists)
      fs.mkdir(name, (createErr) => {
        if (createErr) throw createErr;
      });
  });
}
