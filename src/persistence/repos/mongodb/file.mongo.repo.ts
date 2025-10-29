import {model, Schema} from "mongoose";
import {Service} from "typedi";
import IFileRepo from "../../../service/i-repos/i-file-repo";
import FileDataModel from "../../data-model/file.data-model";
import {MongoRepo} from "./general/mongo-repo";

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
    const result = await this.schema.findOneAndDelete({id});
    return result?.value ?? null;
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
