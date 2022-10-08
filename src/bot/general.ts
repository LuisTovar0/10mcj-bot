import {ReplyQueue} from "./types/botgram";
import del from "del";
import {Container} from "typedi";
import config from "../config";
import IConvoMemoryService from "../service/iService/iConvoMemory.service";

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

export async function deleteUserData(chatId: number) {
  // delete audio if exists
  await del(audiosFolder + String(chatId));
  // delete tracked information
  const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;
  await convoService.delete(chatId);
}
