import DataModel from './dataModel';

export default interface SimpleUserDataModel extends DataModel {
  id: number;
  username?: string;
  chosenPhotoId?: string;
}