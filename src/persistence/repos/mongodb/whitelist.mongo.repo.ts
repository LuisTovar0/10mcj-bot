import { Service } from "typedi";

import IWhitelistRepo from "../../../service/i-repos/i-whitelist.repo";
import ListMongoRepo from "./general/list.mongo.repo";

@Service()
export default class WhitelistMongoRepo extends ListMongoRepo implements IWhitelistRepo {

  constructor() {
    super('telegram-whitelist');
  }

}

