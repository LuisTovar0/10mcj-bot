import {model, Schema} from "mongoose";
import {Service} from "typedi";

import IWhitelistRepo from "../../../service/iRepos/iWhitelist.repo";

interface WhitelistElem {
  chatId: number;
}

@Service()
export default class WhitelistMongoRepo implements IWhitelistRepo {

  private schema = schema;

  async add(chatId: number): Promise<void> {
    await this.schema.create({chatId});
  }

  async isWhitelisted(chatId: number): Promise<boolean> {
    const here = await this.schema.findOne({chatId});
    return !!here
  }

  async remove(chatId: number): Promise<void> {
    await this.schema.deleteOne({chatId});
  }

}

const schema = model<WhitelistElem>(`White-list`, new Schema({
  chatId: {
    type: Number,
    unique: true,
    required: [true, `MongoDB requires a chatId in a whitelist elem.`]
  }
}))
