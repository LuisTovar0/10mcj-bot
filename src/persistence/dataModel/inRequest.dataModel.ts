import DataModel from "./dataModel";

export default interface InRequestDataModel extends DataModel {
  user: string;
  date: number;
}