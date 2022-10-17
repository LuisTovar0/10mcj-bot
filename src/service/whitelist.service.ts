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

  async add(username: string): Promise<void> {
    return this.repo.add(username);
  }

  async isWhitelisted(username: string): Promise<boolean> {
    return this.repo.isWhitelisted(username);
  }

  async remove(username: string): Promise<void> {
    return this.repo.remove(username);
  }

}