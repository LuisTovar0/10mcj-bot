import DataModel from './data-model';

export default interface SimpleUserDataModel extends DataModel {
  id: number;
  username?: string;
  chosenPhotoId?: string;
}
