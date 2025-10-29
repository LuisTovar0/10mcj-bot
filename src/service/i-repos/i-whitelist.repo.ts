import {Message, ReplyQueue} from "../telegram-bot/types/botgram";
import IListRepo from "./i-list.repo";

export default interface IWhitelistRepo extends IListRepo {

  onlyAdminsAllowed(msg: Message, reply: ReplyQueue): Promise<void>;

}
