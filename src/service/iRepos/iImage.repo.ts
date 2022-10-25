import ImageDto from "../../dto/image.dto";

export default interface IImageRepo {

  save(dto: ImageDto): Promise<ImageDto>;

  getById(id: string): Promise<ImageDto | null>;

  getByDomainId(domainId: string): Promise<ImageDto | null>;

  remove(id: string): Promise<ImageDto | null>;

  getAll(): Promise<ImageDto[]>;

}
