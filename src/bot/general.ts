import {ReplyQueue} from "./types/botgram";

const request = require("request");

export const audiosFolder = './audios/';

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

export function markdownWithLinks(reply: ReplyQueue, text: string) {
  reply.sendGeneric("sendMessage",
    {text: text, parse_mode: "Markdown", disable_web_page_preview: true});
}

export function textWithLinks(reply: ReplyQueue, text: string) {
  reply.sendGeneric("sendMessage", {text: text, disable_web_page_preview: true});
}
