import {Message, ReplyQueue} from "./types/botgram";
import del from "del";
import {Container} from "typedi";
import axios from 'axios';

import config from "../config";
import IConvoMemoryService from "../service/iService/iConvoMemory.service";
import BotError from "./botError";
import {tempFolder} from "../config/constants";
import bot from "./bot";

export async function sendMessage(chatId: string, message: string) {
  await apiMethod('sendMessage', {chat_id: chatId, text: message});
}

export async function apiMethod(method: string, params: any) {
  // const apiFunc = `/${method}?${new URLSearchParams(params).toString()}`;
  const axiosResponse = await axios.get<void>(`${bot.telegramUrl}/${method}`, {params});
  console.log(`posted: /${axiosResponse.request.path.split('/')[2]}`);
}

export function markdownHideLinks(reply: ReplyQueue, text: string) {
  reply.sendGeneric("sendMessage",
    {text: text, parse_mode: "Markdown", disable_web_page_preview: true});
}

export function textHideLinks(reply: ReplyQueue, text: string) {
  reply.sendGeneric("sendMessage", {text: text, disable_web_page_preview: true});
}

export async function deleteUserData(chatId: number) {
  // delete audio if exists
  await del(`${tempFolder}/${String(chatId)}`);
  // delete tracked information
  const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;
  await convoService.delete(chatId);
}

export function ensureMsgIsFromAdmin(msg: Message) {
  if (!msgIsFromAdmin(msg))
    throw new BotError('Not allowed.');
}

export function msgIsFromAdmin(msg: Message) {
  return String(msg.chat.id) === bot.adminChatId;
}
