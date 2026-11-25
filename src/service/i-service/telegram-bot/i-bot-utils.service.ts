import fs from "fs";

import { Bot, ReplyQueue } from "../../telegram-bot/types/botgram";
import { FileLike } from "../../telegram-bot/types/model";

export default interface IBotUtilsService {
  token: string;
  methodsUrl: string;
  filesUrl: string;
  adminChatId: number;

  apiMethod(method: string, params: Record<string, string | number> | FormData): Promise<void>;

  sendMessage(chatId: number, message: string): Promise<void>;

  markdownHideLinks(reply: ReplyQueue, text: string): void;

  textHideLinks(reply: ReplyQueue, text: string): void;

  deleteUserData(chatId: number): Promise<void>;

  loadFile(bot: Bot, file: FileLike): Promise<Buffer>;

  saveFile(bot: Bot, file: FileLike, fileName: fs.PathLike): Promise<void>;
}
