import {Service} from "typedi";
import IWhitelistRepo from "../../../service/iRepos/iWhitelist.repo";

@Service()
export default class WhitelistLocalRepo implements IWhitelistRepo {

  private whitelist: number[] = []

  async add(chatId: number): Promise<void> {
    this.whitelist.push(chatId)
  }

  async isWhitelisted(chatId: number): Promise<boolean> {
    return this.whitelist.indexOf(chatId) !== -1;
  }

  async remove(chatId: number): Promise<void> {
    this.whitelist = this.whitelist.filter(v => v !== chatId);
  }

}