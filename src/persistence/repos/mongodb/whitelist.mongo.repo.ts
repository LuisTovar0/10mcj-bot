import {Service} from "typedi";

import IWhitelistRepo from "../../../service/iRepos/iWhitelist.repo";
import ListMongoRepo from "./general/list.mongo.repo";
import BotError from "../../../service/telegramBot/botError";

@Service()
export default class WhitelistMongoRepo extends ListMongoRepo implements IWhitelistRepo {

  constructor() {
    super(`White-list`);
  }

  async usernameIsAllowed(username?: string): Promise<void> {
    if (!username || !(await this.contains(username)))
      throw new BotError('Only admins can use this command.');
  }

  async chatIdIsAllowed(chatId: number): Promise<void> {

  }

}

