import fs from "fs";

import {Bot, Message, ReplyQueue} from "../../telegramBot/types/botgram";
import {FileLike} from "../../telegramBot/types/model";

export default interface IBotUtilsService {
  telegramUrl: string;
  adminChatId: number;

  apiMethod(method: string, params: any): Promise<void>;
  sendMessage(chatId: number, message: string): Promise<void>;
  markdownHideLinks(reply: ReplyQueue, text: string): void;
  textHideLinks(reply: ReplyQueue, text: string): void;
  deleteUserData(chatId: number): Promise<void>;
  ensureMsgIsFromAdmin(msg: Message): void;
  msgIsFromAdmin(msg: Message): boolean;
  saveFile(bot: Bot, msg: Message & { file: FileLike }, fileName: fs.PathLike): Promise<void>;
}
