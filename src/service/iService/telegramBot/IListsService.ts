import {Telegraf} from "telegraf";

import IBlacklistRepo from "../../iRepos/iBlacklist.repo";
import IWhitelistRepo from "../../iRepos/iWhitelist.repo";

export default interface IListsService {

  registerCommands(bot: Telegraf): void;

  isListsCommand(command: string): boolean;

  get blacklist(): IBlacklistRepo;

  get whitelist(): IWhitelistRepo;

}
