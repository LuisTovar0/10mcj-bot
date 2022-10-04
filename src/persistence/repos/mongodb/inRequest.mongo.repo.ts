import {Document, model, Schema, Types} from "mongoose";
import {Service} from "typedi";
import moment from "moment";

import {MongoRepo} from "./mongoRepo";
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

  async requestsLastDays(daysAgo: number) {
    const xDaysAgo = moment().subtract(daysAgo, 'days').valueOf();
    return await this.requestsSince(xDaysAgo);
  }

  async requestsLast15Days() {
    return await this.requestsLastDays(15);
  }

  async requestsLastMonth() {
    const aMonthAgo = moment().subtract(1, 'month').valueOf();
    return await this.requestsSince(aMonthAgo);
  }

  async requestsLastWeek() {
    const aWeekAgo = moment().subtract(1, 'week').valueOf();
    return await this.requestsSince(aWeekAgo);
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
