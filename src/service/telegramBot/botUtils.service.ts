import {Container, Service} from "typedi";
import del from "del";
import axios from "axios";

import BotError from "./botError";
import IBotUtilsService from "../iService/telegramBot/iBotUtils.service";
import config, {loadEnvVar} from "../../config";
import {tempFolder} from "../../config/constants";
import IConvoMemoryService from "../iService/telegramBot/iConvoMemory.service";
import {Context} from "telegraf";
import * as fs from "fs";
import moment from "moment";

@Service()
export default class BotUtilsService implements IBotUtilsService {

  readonly token = loadEnvVar('botToken');
  readonly filesUrl = `https://api.telegram.org/file/bot${this.token}`;
  readonly methodsUrl = `https://api.telegram.org/bot${this.token}`;
  readonly adminChatId = Number(loadEnvVar('adminChatId'));

  async apiMethod(method: string, params: any) {
    // const apiFunc = `/${method}?${new URLSearchParams(params).toString()}`;
    const axiosResponse = await axios.get<void>(`${this.methodsUrl}/${method}`, {params});
    console.log(`posted: /${axiosResponse.request.path.split('/')[2]}`);
  }

  async sendMessage(chatId: number, message: string) {
    await this.apiMethod('sendMessage', {chat_id: chatId, text: message});
  }

  async getFile(fileAtTelegram: string): Promise<Buffer> {
    //todo make it faster
    const response = await axios.get(`${this.filesUrl}/${fileAtTelegram}`, {responseType: "stream"});
    const fileName = moment().valueOf().toString();
    response.data.pipe(fs.createWriteStream(fileName));
    const tryReadFile = async (): Promise<Buffer> => {
      console.count(`try read file ${fileName}`);
      try {
        return fs.readFileSync(fileName);
      } catch (e) {
        await new Promise(r => setTimeout(r, 50));
        return await tryReadFile();
      }
    };
    const buffer = await tryReadFile();
    fs.rmSync(fileName);
    return buffer;
  }

  async deleteUserData(chatId: number): Promise<void> {
    // delete audio if exists
    await del(`${tempFolder}/${String(chatId)}`);
    // delete tracked information
    const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;
    await convoService.delete(chatId);
  }

  ensureMsgIsFromAdmin(ctx: Context): void {
    if (!this.msgIsFromAdmin(ctx))
      throw new BotError('Not allowed.');
  }

  msgIsFromAdmin(ctx: Context): boolean {
    if (!ctx || !ctx.chat) return false;
    return ctx.chat.id === this.adminChatId;
  }

}