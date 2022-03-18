import request from "request";

export const audiosFolder = './audios/';

export function sendMessage(chatId, message) {
  apiMethod('sendMessage', {chat_id: chatId, text: message});
}

export function apiMethod(method, params) {
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
  const apiFunc = `/${method}?${new URLSearchParams(params).toString()}`;
  const text = base + apiFunc;
  console.log('posted: ' + apiFunc);
  request(text);
}
