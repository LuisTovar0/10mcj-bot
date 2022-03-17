import request from "request";

export const audiosFolder = './audios/';

export function sendMessage(chatId, message) {
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/`;
  const apiFunc = `sendMessage?chat_id=${chatId}&text=${encodeURI(message)}`;
  const text = base + apiFunc;
  console.log('posted: /' + apiFunc);
  request(text);
}
