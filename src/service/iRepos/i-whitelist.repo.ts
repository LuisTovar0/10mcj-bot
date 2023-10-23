import IListRepo from "./i-list.repo";
import {Message, ReplyQueue} from "../telegramBot/types/botgram";

export default interface IWhitelistRepo extends IListRepo {

  onlyAdminsAllowed(msg: Message, reply: ReplyQueue): Promise<void>;

}
