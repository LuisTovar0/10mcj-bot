import {model, Schema} from 'mongoose';
import {Service} from "typedi";

import ISimpleUserRepo from "../../../service/iRepos/iSimpleUser.repo";
import SimpleUserDataModel from "../../dataModel/simpleUser.dataModel";
import {MongoRepo} from "./general/mongoRepo";

@Service()
export default class SimpleUserMongoDb extends MongoRepo<SimpleUserDataModel> implements ISimpleUserRepo {

  constructor() {
    super(schema);
  }

  async getByDomainId(id: string): Promise<SimpleUserDataModel | null> {
    return this.findByDomainId(id);
  }

  async getById(id: number): Promise<SimpleUserDataModel | null> {
    return this.schema.findOne({id});
  }

  async save(dataModel: SimpleUserDataModel): Promise<SimpleUserDataModel> {
    return await this.persist(dataModel);
  }

  async getByUsername(username: string): Promise<SimpleUserDataModel | null> {
    return this.schema.findOne({username});
  }

}

const schema = model<SimpleUserDataModel>(`Simple User`, new Schema({
  domainId: {
    type: String,
    required: [true, `MongoDB requires a SimpleUser domain ID.`],
    unique: true
  },
  id: {
    type: Number,
    required: [true, `MongoDB requires a SimpleUser chat ID.`],
    unique: true
  },
  username: {
    type: String,
    unique: true
  },
  // firstname: {
  //   type: String,
  //   required: [true, `MongoDB requires a SimpleUser first name.`]
  // },
  // lastname: {
  //   type: String,
  // }
}));
