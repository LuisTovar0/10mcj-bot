import DataModel from "./data-model";

export default interface ImageDataModel extends DataModel {
  fileDomainId: string;
  offset?: number;
  // format: string;
}
