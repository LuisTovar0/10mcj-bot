import IBlacklistRepo from "../../i-repos/i-blacklist.repo";
import IWhitelistRepo from "../../i-repos/i-whitelist.repo";
import {Bot} from "../../telegram-bot/types/botgram";

export default interface IListsService {

  registerCommands(bot: Bot): void;

  isListsCommand(command: string): boolean;

  get blacklist(): IBlacklistRepo;

  get whitelist(): IWhitelistRepo;

}
