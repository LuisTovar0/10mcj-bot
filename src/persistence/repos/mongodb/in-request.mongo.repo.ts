import moment from "moment";
import {Document, model, Schema, Types} from "mongoose";
import {Service} from "typedi";
import IInRequestRepo from "../../../service/i-repos/i-in-request.repo";
import InRequestDataModel from "../../data-model/in-request.data-model";

import {MongoRepo} from "./general/mongo-repo";

@Service()
export default class InRequestMongoDb extends MongoRepo<ActualDataModel> implements IInRequestRepo {

  constructor() {
    super(schema);
  }

  static mapSchemaToDataModel(schema: Document<unknown, any, ActualDataModel> & ActualDataModel & { _id: Types.ObjectId }) {
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

interface ActualDataModel {
  domainId: string;
  user: string;
}

const schema = model<ActualDataModel>(`In Request`, new Schema({
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
