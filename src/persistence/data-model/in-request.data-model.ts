import DataModel from "./data-model";

export default interface InRequestDataModel extends DataModel {
  user: string;
  date: number;
}
