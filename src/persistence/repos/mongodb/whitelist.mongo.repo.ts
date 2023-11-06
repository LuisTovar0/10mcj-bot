import {Service} from "typedi";

import IWhitelistRepo from "../../../service/i-repos/i-whitelist.repo";
import BotError from "../../../service/telegram-bot/bot-error";
import {Message, ReplyQueue} from "../../../service/telegram-bot/types/botgram";
import ListMongoRepo from "./general/list.mongo.repo";

@Service()
export default class WhitelistMongoRepo extends ListMongoRepo implements IWhitelistRepo {

  constructor() {
    super(`White-list`);
  }

  async onlyAdminsAllowed(msg: Message, reply: ReplyQueue): Promise<void> {
    if (!msg.chat.username || !(await this.contains(msg.chat.username)))
      throw new BotError('Only admins can use this command.');
  }

}

