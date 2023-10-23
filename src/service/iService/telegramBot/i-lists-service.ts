import {Bot} from "../../telegramBot/types/botgram";
import IBlacklistRepo from "../../iRepos/i-blacklist.repo";
import IWhitelistRepo from "../../iRepos/i-whitelist.repo";

export default interface IListsService {

  registerCommands(bot: Bot): void;

  isListsCommand(command: string): boolean;

  get blacklist(): IBlacklistRepo;

  get whitelist(): IWhitelistRepo;

}
