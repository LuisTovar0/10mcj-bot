import IListRepo from "./iList.repo";
import {Message, ReplyQueue} from "../telegramBot/types/botgram";

export default interface IWhitelistRepo extends IListRepo {

  onlyAdminsAllowed(msg: Message, reply: ReplyQueue): Promise<void>;

}
