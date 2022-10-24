import DataModel from "./dataModel";

export default interface ImageDataModel extends DataModel {
  fileDomainId: string;
  offset?: number;
  format: string;
}
