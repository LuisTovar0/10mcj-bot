import {Model} from "mongoose";

import DataModel from "../../dataModel/dataModel";

export abstract class MongoRepo<TDataModel extends DataModel> {

  protected constructor(protected schema: Model<TDataModel>) {
  }

  protected async findByDomainId(id: string): Promise<TDataModel | null> {
    return this.schema.findOne({domainId: id});
  }

  protected async persist(dataModel: TDataModel): Promise<TDataModel> {
    // const existingDataModel = await this.findByDomainId(dataModel.domainId);
    // if (existingDataModel !== null)
    //   throw new Error('ID ' + dataModel.domainId + ' already exists.');
    return await this.schema.create(dataModel);
  }

}
