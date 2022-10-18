import {Service} from "typedi";
import {MongoRepo} from "./general/mongoRepo";
import {model, Schema} from "mongoose";
import FileDataModel from "../../dataModel/file.dataModel";
import IFileRepo from "../../../service/iRepos/iFileRepo";

@Service()
export default class FileMongoRepo extends MongoRepo<FileDataModel> implements IFileRepo {

  async getById(fileId: string) {
    const res = await this.schema.findOne({fileId});
    return res === null ? undefined : res;
  }

  async save(dataModel: FileDataModel) {
    return await this.persist(dataModel);
  }

  async getByDomainId(domainId: string) {
    const res = await this.findByDomainId(domainId);
    return res === null ? undefined : res;
  }

  async remove(fileId: string) {
    const res = await this.schema.findOneAndDelete({fileId});
    return res === null ? undefined : res;
  }

  constructor() {
    super(model<FileDataModel>('File', new Schema(({
      domainId: {
        type: String,
        required: [true, 'MongoDB requires the file to have a domainId.']
      },
      type: {
        type: String,
        required: [true, 'MongoDB requires the file to have a type.']
      },
      fileId: {
        type: String,
        required: [true, 'MongoDB requires the file to have a fileId.']
      },
      file: {
        type: Buffer,
        required: [true, 'MongoDB requires the file to have a file (buffer).']
      }
    }))));
  }

}
