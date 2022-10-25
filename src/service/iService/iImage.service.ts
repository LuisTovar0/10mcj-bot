import ImageDto from "../../dto/image.dto";

export default interface IImageService {

  save(dto: ImageDto): Promise<ImageDto>;

  getById(id: string): Promise<ImageDto | null>;

  getByDomainId(domainId: string): Promise<ImageDto | null>;

  remove(id: string): Promise<ImageDto | null>;

}