import {ReplyQueue} from "./types/botgram";
import axios from 'axios';

export const audiosFolder = './audios/';

export async function sendMessage(chatId: string, message: string) {
  await apiMethod('sendMessage', {chat_id: chatId, text: message});
}

export async function apiMethod(method: string, params: any) {
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
  const apiFunc = `/${method}?${new URLSearchParams(params).toString()}`;
  await axios.get<void>(`${base}/${method}`, {params});
  console.log(`posted: ${apiFunc}`);
}

export function markdownWithLinks(reply: ReplyQueue, text: string) {
  reply.sendGeneric("sendMessage",
    {text: text, parse_mode: "Markdown", disable_web_page_preview: true});
}

export function textWithLinks(reply: ReplyQueue, text: string) {
  reply.sendGeneric("sendMessage", {text: text, disable_web_page_preview: true});
}
