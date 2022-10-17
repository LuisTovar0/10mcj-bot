import {Model} from "mongoose";

import DataModel from "../../dataModel/dataModel";

export abstract class MongoRepo<TDataModel extends DataModel> {

  protected constructor(protected schema: Model<TDataModel>) {
  }

  protected async findByDomainId(domainId: string): Promise<TDataModel | null> {
    return this.schema.findOne({domainId});
  }

  protected async persist(dataModel: TDataModel): Promise<TDataModel> {
    return await this.schema.create(dataModel);
  }

}
