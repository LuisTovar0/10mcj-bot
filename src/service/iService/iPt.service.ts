import {Bot, ReplyQueue} from "../telegramBot/types/botgram";
import {messageAudio, messageText} from "../telegramBot/types/model";

export default interface IPtService {

  registerCommands(bot: Bot): void;

  handleAudio(bot: Bot, msg: messageAudio, reply: ReplyQueue): Promise<void>;

  handleText(msg: messageText, reply: ReplyQueue): Promise<void>;

  isPtCommand(command?: string): boolean;

}