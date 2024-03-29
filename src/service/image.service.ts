import {Inject, Service} from "typedi";
import config from "../config";
import IImageRepo from "./iRepos/iImage.repo";
import ImageDto from "../dto/image.dto";
import IImageService from "./iService/iImage.service";

@Service()
export default class ImageService implements IImageService {

  constructor(
    @Inject(config.deps.repo.image.name) private repo: IImageRepo
  ) {
  }

  async save(dto: ImageDto) {
    return await this.repo.save(dto);
  }

  async getById(id: string) {
    return await this.repo.getById(id);
  }

  async getByDomainId(domainId: string) {
    return await this.repo.getByDomainId(domainId);
  }

  async remove(id: string) {
    return await this.repo.remove(id);
  }

  async getAll() {
    return await this.repo.getAll();
  }

}