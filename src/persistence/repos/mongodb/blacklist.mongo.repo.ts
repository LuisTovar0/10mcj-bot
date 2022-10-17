import {Service} from "typedi";

import IBlacklistRepo from "../../../service/iRepos/iBlacklist.repo";
import ListMongoRepo from "./general/list.mongo.repo";

@Service()
export default class BlacklistMongoRepo extends ListMongoRepo implements IBlacklistRepo {

  constructor() {
    super(`Black-list`);
  }

}
