import {model, Schema} from "mongoose";
import {Service} from "typedi";

import IWhitelistRepo from "../../../service/iRepos/iWhitelist.repo";

interface WhitelistElem {
  username: string;
}

@Service()
export default class WhitelistMongoRepo implements IWhitelistRepo {

  private schema = schema;

  async add(username: string): Promise<void> {
    await this.schema.create({username});
  }

  async isWhitelisted(username: string): Promise<boolean> {
    const here = await this.schema.findOne({username});
    return !!here
  }

  async remove(username: string): Promise<void> {
    await this.schema.deleteOne({username});
  }

}

const schema = model<WhitelistElem>(`White-list`, new Schema({
  username: {
    type: String,
    unique: true,
    required: [true, `MongoDB requires a username in a whitelist elem.`]
  }
}))
