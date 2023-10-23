import DataModel from "./data-model";

export default interface FileDataModel extends DataModel {
  id: string
  file: Buffer
}
