import {Service} from "typedi";
import IWhitelistRepo from "../../../service/iRepos/iWhitelist.repo";

@Service()
export default class WhitelistLocalRepo implements IWhitelistRepo {

  private whitelist: string[] = []

  async add(username: string): Promise<void> {
    this.whitelist.push(username)
  }

  async isWhitelisted(username: string): Promise<boolean> {
    return this.whitelist.indexOf(username) !== -1;
  }

  async remove(username: string): Promise<void> {
    this.whitelist = this.whitelist.filter(v => v !== username);
  }

  async fullWhitelist(): Promise<string[]> {
    return [...this.whitelist]; // copy
  }

}