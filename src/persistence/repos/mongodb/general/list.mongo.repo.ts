import {model, Schema} from "mongoose";
import IListRepo from "../../../../service/iRepos/i-list.repo";

export interface WhitelistElem {
  username: string;
}

export default abstract class ListMongoRepo implements IListRepo {

  private schema;

  protected constructor(name: string) {
    this.schema = model<WhitelistElem>(name, new Schema({
      username: {
        type: String,
        unique: true,
        required: [true, `MongoDB requires a username in a ${name} elem.`]
      }
    }));
  }

  async add(username: string): Promise<void> {
    await this.schema.create({username});
  }

  async contains(username: string): Promise<boolean> {
    const here = await this.schema.findOne({username});
    return !!here;
  }

  async remove(username: string): Promise<void> {
    await this.schema.deleteOne({username});
  }

  async fullList(): Promise<string[]> {
    return (await this.schema.find()).map(a => a.username);
  }
}
