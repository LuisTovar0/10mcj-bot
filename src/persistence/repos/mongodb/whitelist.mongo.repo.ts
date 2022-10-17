import {Service} from "typedi";

import IWhitelistRepo from "../../../service/iRepos/iWhitelist.repo";
import ListMongoRepo from "./general/list.mongo.repo";

@Service()
export default class WhitelistMongoRepo extends ListMongoRepo implements IWhitelistRepo {

  constructor() {
    super(`White-list`);
  }

}

