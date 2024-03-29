import FileDataModel from "../../persistence/dataModel/file.dataModel";

export default interface IFileRepo {

  getById(fileId: string): Promise<FileDataModel | null>;

  save(dataModel: FileDataModel): Promise<FileDataModel>;

  getByDomainId(domainId: string): Promise<FileDataModel | null>;

  remove(fileId: string): Promise<FileDataModel | null>;

}