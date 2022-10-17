import {Document, model, Schema, Types} from "mongoose";
import {Service} from "typedi";
import moment from "moment";

import {MongoRepo} from "./general/mongoRepo";
import InRequestDataModel from "../../dataModel/inRequest.dataModel";
import IInRequestRepo from "../../../service/iRepos/iInRequest.repo";

@Service()
export default class InRequestMongoDb extends MongoRepo<{ domainId: string, user: string }> implements IInRequestRepo {

  constructor() {
    super(schema);
  }

  static mapSchemaToDataModel(schema: Document<unknown, any, { domainId: string, user: string }> & { domainId: string, user: string } & { _id: Types.ObjectId }) {
    // @ts-ignore
    const date = moment(schema.createdAt).valueOf();
    return {
      domainId: schema.domainId,
      user: schema.user,
      date
    } as InRequestDataModel;
  }

  async newRequest(domainId: string, user: string): Promise<InRequestDataModel> {
    const persisted = await this.schema.create({domainId, user});
    return InRequestMongoDb.mapSchemaToDataModel(persisted);
  }

  async requestsSince(dateLong: number): Promise<InRequestDataModel[]> {
    const res = await this.schema.find({createdAt: {$gt: dateLong}});
    return res.map(InRequestMongoDb.mapSchemaToDataModel);
  }

}

const schema = model<{ domainId: string, user: string }>(`In Request`, new Schema({
  domainId: {
    type: String,
    required: [true, `MongoDB requires an InRequest domain ID.`],
    unique: true
  },
  user: {
    type: String,
    required: [true, `MongoDB requires an InRequest user's domain ID`]
  }
}, {timestamps: true}));
