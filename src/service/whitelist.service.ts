import {Inject, Service} from "typedi";
import IWhitelistService from "./iService/iWhitelist.service";
import config from "../config";
import IWhitelistRepo from "./iRepos/iWhitelist.repo";

@Service()
export default class WhitelistService implements IWhitelistService {

  constructor(
    @Inject(config.deps.repo.whitelist.name) private repo: IWhitelistRepo
  ) {
  }

  async add(chatId: number): Promise<void> {
    return this.repo.add(chatId);
  }

  async isWhitelisted(chatId: number): Promise<boolean> {
    return this.repo.isWhitelisted(chatId);
  }

  async remove(chatId: number): Promise<void> {
    return this.repo.remove(chatId);
  }

}