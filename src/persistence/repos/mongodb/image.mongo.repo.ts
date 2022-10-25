import {Inject, Service} from "typedi";
import {model, Schema} from "mongoose";

import config from "../../../config";
import IFileRepo from "../../../service/iRepos/iFileRepo";
import {MongoRepo} from "./general/mongoRepo";
import ImageDataModel from "../../dataModel/image.dataModel";
import * as imageMapper from '../../../mappers/image.mapper';
import ImageDto from "../../../dto/image.dto";
import IImageRepo from "../../../service/iRepos/iImage.repo";

@Service()
export default class ImageMongoRepo extends MongoRepo<ImageDataModel> implements IImageRepo {

  async save(dto: ImageDto): Promise<ImageDto> {
    const {img, file} = imageMapper.dtoToDataModel(dto);
    const persistedFile = await this.fileRepo.save(file);
    const persistedImg = await this.persist(img);
    return imageMapper.dataModelToDto(persistedImg, persistedFile);
  }

  async getById(id: string): Promise<ImageDto | null> {
    const file = await this.fileRepo.getById(id);
    if (!file) return null;
    const img = await this.schema.findOne({fileDomainId: file.domainId});
    if (!img) return null;
    return imageMapper.dataModelToDto(img, file);
  }

  async getByDomainId(domainId: string): Promise<ImageDto | null> {
    const img = await this.findByDomainId(domainId);
    if (!img) return null;
    const file = await this.fileRepo.getByDomainId(img.fileDomainId);
    if (!file) return null;
    return imageMapper.dataModelToDto(img, file);
  }

  async remove(id: string): Promise<ImageDto | null> {
    const removedFile = await this.fileRepo.remove(id);
    if (!removedFile) return null;
    const removedImg = await this.schema.findOneAndDelete({fileDomainId: removedFile.domainId});
    if (!removedImg) return null;
    return imageMapper.dataModelToDto(removedImg, removedFile);
  }

  constructor(
    @Inject(config.deps.repo.file.name) private fileRepo: IFileRepo
  ) {
    super(model<ImageDataModel>('Image', new Schema({
      domainId: {
        type: String,
        required: [true, 'MongoDB requires the image to have a domainId.']
      },
      fileDomainId: {
        type: String,
        required: [true, 'MongoDB requires the image to have a file domainId']
      },
      offset: Number
    })));
  }

}
