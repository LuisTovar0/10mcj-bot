import DataModel from "./dataModel";

export default interface FileDataModel extends DataModel {
  id: string
  file: Buffer
}
