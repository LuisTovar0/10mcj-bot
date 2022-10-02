const request = require("request");

export const audiosFolder = './audios/';

export function hasEntries(obj: any) {
  return Object.entries(obj).length;
}

export function sendMessage(chatId: string, message: string) {
  apiMethod('sendMessage', {chat_id: chatId, text: message});
}

export function apiMethod(method: string, params: any) {
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
  const apiFunc = `/${method}?${new URLSearchParams(params).toString()}`;
  const text = base + apiFunc;
  console.log('posted: ' + apiFunc);
  request(text);
}
