import type { BotMenu, RegisterMenuAction } from "../telegram-bot/bot-menu";
import { Bot, ReplyQueue } from "../telegram-bot/types/botgram";
import { messagePhoto, messageText } from "../telegram-bot/types/model";

export default interface IImageCommandsService {

  registerCommands(bot: Bot, menu: BotMenu, registerMenuAction: RegisterMenuAction): void;

  handlePhoto(bot: Bot, msg: messagePhoto, reply: ReplyQueue, menu: BotMenu): Promise<void>;

  handleText(msg: messageText, menu: BotMenu): Promise<void>;

  isImageCommand(command: string): boolean;

}
