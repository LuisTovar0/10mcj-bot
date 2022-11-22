import {Context} from "telegraf";

export default interface IBotUtilsService {
  token: string;
  methodsUrl: string;
  filesUrl: string;
  adminChatId: number;

  apiMethod(method: string, params: any): Promise<void>;

  sendMessage(chatId: number, message: string): Promise<void>;

  deleteUserData(chatId: number): Promise<void>;

  ensureMsgIsFromAdmin(ctx: Context): void;

  msgIsFromAdmin(ctx: Context): boolean;

  // saveFile(bot: Telegraf, file: FileLike, fileName: fs.PathLike): Promise<void>;
}
