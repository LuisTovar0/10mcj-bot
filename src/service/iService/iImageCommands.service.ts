import {Context, Telegraf} from "telegraf";

export default interface IImageCommandsService {

  registerCommands(bot: Telegraf): void;

  handlePhoto(bot: Telegraf, ctx: Context): Promise<void>;

  handleText(ctx: Context): Promise<void>;

  isImageCommand(command: string): boolean;

}
