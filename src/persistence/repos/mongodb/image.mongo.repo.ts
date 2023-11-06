import {model, Schema} from "mongoose";
import {Inject, Service} from "typedi";

import config from "../../../config";
import ImageDto from "../../../dto/image.dto";
import * as imageMapper from '../../../mappers/image.mapper';
import IFileRepo from "../../../service/i-repos/i-file-repo";
import IImageRepo from "../../../service/i-repos/i-image.repo";
import ImageDataModel from "../../data-model/image.data-model";
import {MongoRepo} from "./general/mongo-repo";

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

  async getAll(): Promise<ImageDto[]> {
    const imgs: ImageDataModel[] = await this.schema.find();
    const ret: ImageDto[] = [];
    for (const img of imgs) {
      const file = await this.fileRepo.getByDomainId(img.fileDomainId);
      if (file)
        ret.push(imageMapper.dataModelToDto(img, file));
    }
    return ret;
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
