import {Container, Service} from "typedi";
import axios from "axios";
import fs from "fs";

import {FileLike} from "./types/model";
import {Bot, Message, ReplyQueue} from "./types/botgram";
import BotError from "./botError";
import IBotUtilsService from "../iService/iBotUtils.service";
import config, {loadEnvVar} from "../../config";
import del from "del";
import {tempFolder} from "../../config/constants";
import IConvoMemoryService from "../iService/iConvoMemory.service";

@Service()
export default class BotUtilsService implements IBotUtilsService {

  readonly telegramUrl = `https://api.telegram.org/bot${loadEnvVar('botToken')}`;
  readonly adminChatId = Number(loadEnvVar('adminChatId'));

  async apiMethod(method: string, params: any) {
    // const apiFunc = `/${method}?${new URLSearchParams(params).toString()}`;
    const axiosResponse = await axios.get<void>(`${this.telegramUrl}/${method}`, {params});
    console.log(`posted: /${axiosResponse.request.path.split('/')[2]}`);
  }

  async sendMessage(chatId: number, message: string) {
    await this.apiMethod('sendMessage', {chat_id: chatId, text: message});
  }

  saveFile(bot: Bot, msg: Message & { file: FileLike }, fileName: fs.PathLike): Promise<void> {
    return new Promise(resolve => {
      bot.fileLoad(msg.file, (err: any, buffer: any) => {
        if (err) throw err;
        let stream = fs.createWriteStream(fileName);
        stream.on('close', async (err: any) => {
          if (err) {
            console.log(err);
            throw new BotError(`Failed creating ${fileName}`);
          }
          resolve();
        });
        stream.end(buffer);
      });
    });
  }

  async deleteUserData(chatId: number): Promise<void> {
    // delete audio if exists
    await del(`${tempFolder}/${String(chatId)}`);
    // delete tracked information
    const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;
    await convoService.delete(chatId);
  }

  ensureMsgIsFromAdmin(msg: Message): void {
    if (!this.msgIsFromAdmin(msg))
      throw new BotError('Not allowed.');
  }

  markdownHideLinks(reply: ReplyQueue, text: string): void {
    reply.sendGeneric("sendMessage",
      {text: text, parse_mode: "Markdown", disable_web_page_preview: true});
  }

  msgIsFromAdmin(msg: Message): boolean {
    return msg.chat.id === this.adminChatId;
  }

  textHideLinks(reply: ReplyQueue, text: string): void {
    reply.sendGeneric("sendMessage", {text: text, disable_web_page_preview: true});
  }

}