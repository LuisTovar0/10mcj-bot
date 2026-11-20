import type { BotMenu, RegisterMenuAction } from "../../telegram-bot/bot-menu";
import { Bot, ReplyQueue } from "../../telegram-bot/types/botgram";
import { messageAudio, messageText } from "../../telegram-bot/types/model";

export default interface IPtService {

  registerCommands(menu: BotMenu, registerMenuAction: RegisterMenuAction): void;

  handleAudio(bot: Bot, msg: messageAudio, reply: ReplyQueue, menu: BotMenu): Promise<void>;

  handleText(msg: messageText, reply: ReplyQueue, menu: BotMenu): Promise<void>;

  isPtCommand(command?: string): boolean;

}
