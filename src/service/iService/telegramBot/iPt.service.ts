import {Context, Telegraf} from "telegraf";

export default interface IPtService {

  registerCommands(bot: Telegraf): void;

  // handleAudio(bot: Telegraf, ctx: Context): Promise<void>;

  // handleText(ctx: Context): Promise<void>;

  finally(ctx: Context): Promise<void>;

  isPtCommand(command?: string): boolean;

}