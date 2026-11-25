import fs from "fs";
import { rm, writeFile } from "node:fs/promises";
import { Container, Service } from "typedi";
import config, { loadEnvVar } from "../../config";
import { tempFolder } from "../../config/constants";
import { fetchChecked } from "../fetch-checked";
import IBotUtilsService from "../i-service/telegram-bot/i-bot-utils.service";
import IConvoMemoryService from "../i-service/telegram-bot/i-convo-memory.service";
import { parseTelegramUserId } from "./telegram-user-id";
import { Bot, ReplyQueue } from "./types/botgram";

import { FileLike } from "./types/model";

@Service()
export default class BotUtilsService implements IBotUtilsService {

  readonly token = loadEnvVar('botToken');
  readonly filesUrl = `https://api.telegram.org/file/bot${ this.token }`;
  readonly methodsUrl = `https://api.telegram.org/bot${ this.token }`;
  readonly adminChatId: number;

  constructor() {
    const adminChatId = parseTelegramUserId(loadEnvVar('adminChatId'));
    if (adminChatId === undefined) throw new Error('ADMIN_CHAT_ID must be a positive decimal Telegram user ID.');
    this.adminChatId = adminChatId;
  }

  async apiMethod(method: string, params: Record<string, string | number> | FormData): Promise<void> {
    const url = new URL(`${ this.methodsUrl }/${ method }`);
    let options: RequestInit | undefined;
    if (params instanceof FormData) {
      options = { method: "POST", body: params };
    } else {
      for (const [ key, value ] of Object.entries(params)) url.searchParams.set(key, String(value));
    }
    const response = await fetchChecked(url, `Telegram ${ method }`, options);
    const result = await response.json() as { ok: boolean };
    if (!result.ok) throw new Error(`Telegram ${ method } was rejected.`);
    console.log(`posted: /${ method }`);
  }

  async sendMessage(chatId: number, message: string) {
    await this.apiMethod('sendMessage', { chat_id: chatId, text: message });
  }

  loadFile(bot: Bot, file: FileLike): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      bot.fileLoad(file, (error, buffer) => {
        if (error || !buffer) reject(error ?? new Error('Telegram returned no file data.'));
        else resolve(buffer);
      });
    });
  }

  async saveFile(bot: Bot, file: FileLike, fileName: fs.PathLike): Promise<void> {
    await writeFile(fileName, await this.loadFile(bot, file));
  }

  async deleteUserData(chatId: number): Promise<void> {
    // delete audio if exists
    await rm(`${ tempFolder }/${ String(chatId) }`, { recursive: true, force: true });
    // delete tracked information
    const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;
    await convoService.delete(chatId);
  }

  markdownHideLinks(reply: ReplyQueue, text: string): void {
    reply.sendGeneric("sendMessage",
        { text: text, parse_mode: "Markdown", disable_web_page_preview: true });
  }

  textHideLinks(reply: ReplyQueue, text: string): void {
    reply.sendGeneric("sendMessage", { text: text, disable_web_page_preview: true });
  }

}
