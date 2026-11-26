import type { BotMenu, RegisterMenuAction } from "../telegram-bot/bot-menu";
import type { PrivateChatUpdate } from "../telegram-bot/telegram-user-id";
import { Bot, ReplyQueue } from "../telegram-bot/types/botgram";
import { messagePhoto, messageText } from "../telegram-bot/types/model";

export default interface IImageCommandsService {

  registerCommands(bot: Bot, menu: BotMenu, registerMenuAction: RegisterMenuAction): void;

  handlePhoto(bot: Bot, msg: messagePhoto, reply: ReplyQueue, menu: BotMenu): Promise<void>;

  handleText(bot: Bot, msg: messageText, menu: BotMenu): Promise<void>;

  handleOtherInput(bot: Bot, msg: PrivateChatUpdate, menu: BotMenu): Promise<boolean>;

  isImageCommand(command: string): boolean;

}
