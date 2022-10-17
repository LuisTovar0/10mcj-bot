import {Bot} from "../../bot/types/botgram";

export default interface IWhitelistService {

  registerCommands(bot: Bot): void;

  isWhitelistCommand(command: string): boolean;

}
