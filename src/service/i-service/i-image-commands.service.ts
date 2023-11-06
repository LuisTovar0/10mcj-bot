import {Bot, ReplyQueue} from "../telegram-bot/types/botgram";
import {messagePhoto, messageText} from "../telegram-bot/types/model";

export default interface IImageCommandsService {

  registerCommands(bot: Bot): void;

  handlePhoto(bot: Bot, msg: messagePhoto, reply: ReplyQueue): Promise<void>;

  handleText(msg: messageText, reply: ReplyQueue): Promise<void>;

  isImageCommand(command: string): boolean;

}
