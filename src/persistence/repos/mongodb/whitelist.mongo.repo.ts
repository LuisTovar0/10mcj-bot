import {Service} from "typedi";

import IWhitelistRepo from "../../../service/iRepos/iWhitelist.repo";
import ListMongoRepo from "./general/list.mongo.repo";
import {Message, ReplyQueue} from "../../../service/telegramBot/types/botgram";
import BotError from "../../../service/telegramBot/botError";

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

