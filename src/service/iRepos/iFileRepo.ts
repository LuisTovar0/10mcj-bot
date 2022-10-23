import FileDataModel from "../../persistence/dataModel/file.dataModel";

export default interface IFileRepo {

  getById(fileId: string): Promise<FileDataModel | undefined>;

  save(dataModel: FileDataModel): Promise<FileDataModel>;

  getByDomainId(domainId: string): Promise<FileDataModel | undefined>;

  remove(fileId: string): Promise<FileDataModel | undefined>;

}