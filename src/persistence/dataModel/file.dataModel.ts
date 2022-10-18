import DataModel from "./dataModel";

export default interface FileDataModel extends DataModel {
  type: string
  fileId: string
  file: Buffer
}
