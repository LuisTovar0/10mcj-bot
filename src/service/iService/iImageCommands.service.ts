import {Context, Telegraf} from "telegraf";

export default interface IImageCommandsService {

  registerCommands(bot: Telegraf): void;

  isImageCommand(command: string): boolean;

  finallyAddImage(chatId: number, ctx: Context): Promise<void>;

}
