import {Message, ReplyQueue} from "./types/botgram";
import del from "del";
import {Container} from "typedi";
import config from "../config";
import IConvoMemoryService from "../service/iService/iConvoMemory.service";
import axios from 'axios';
import BotError from "./botError";

export const filesFolder = './files'
export const audiosFolder = `${filesFolder}/audios`;

export async function sendMessage(chatId: string, message: string) {
  await apiMethod('sendMessage', {chat_id: chatId, text: message});
}

export async function apiMethod(method: string, params: any) {
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
  // const apiFunc = `/${method}?${new URLSearchParams(params).toString()}`;
  const axiosResponse = await axios.get<void>(`${base}/${method}`, {params});
  console.log(`posted: /${axiosResponse.request.path.split('/')[2]}`);
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
  await del(`${audiosFolder}/${String(chatId)}`);
  // delete tracked information
  const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;
  await convoService.delete(chatId);
}

export function ensureMsgIsFromAdmin(msg: Message) {
  if (!msgIsFromAdmin(msg))
    throw new BotError('Not allowed.');
}

export function msgIsFromAdmin(msg: Message) {
  return String(msg.chat.id) === config.adminChatId
}
