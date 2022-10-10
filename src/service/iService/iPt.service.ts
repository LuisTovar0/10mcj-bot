import {Bot, ReplyQueue} from "../../bot/types/botgram";
import {messageAudio, messageText} from "../../bot/types/model";

export default interface IPtService {

  registarComandos(bot: Bot): void;

  handleAudio(bot: Bot, msg: messageAudio, reply: ReplyQueue): Promise<void>;

  handleText(msg: messageText, reply: ReplyQueue): Promise<void>;

  isPtCommand(command?: string): boolean;

}