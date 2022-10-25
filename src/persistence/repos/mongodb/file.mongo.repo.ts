import {Service} from "typedi";
import {MongoRepo} from "./general/mongoRepo";
import {model, Schema} from "mongoose";
import FileDataModel from "../../dataModel/file.dataModel";
import IFileRepo from "../../../service/iRepos/iFileRepo";

@Service()
export default class FileMongoRepo extends MongoRepo<FileDataModel> implements IFileRepo {

  async getById(id: string) {
    return this.schema.findOne({id});
  }

  async save(dataModel: FileDataModel) {
    return await this.persist(dataModel);
  }

  getByDomainId(domainId: string) {
    return this.findByDomainId(domainId);
  }

  async remove(id: string) {
    return this.schema.findOneAndDelete({id});
  }

  constructor() {
    super(schema);
  }

}

const schema = model<FileDataModel>('File', new Schema({
  domainId: {
    type: String,
    required: [true, 'MongoDB requires the file to have a domainId.']
  },
  id: {
    type: String,
    required: [true, 'MongoDB requires the file to have a fileId.']
  },
  file: {
    type: Buffer,
    required: [true, 'MongoDB requires the file to have a file (buffer).']
  }
}));
