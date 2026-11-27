import type { ThumbnailBackground } from '../../domain/simple-user';
import type { ThumbnailStyle } from '../../domain/thumbnail-style';
import DataModel from './data-model';

export default interface SimpleUserDataModel extends DataModel {
  id: number;
  username?: string;
  chosenPhotoId?: string;
  lastThumbnailBackground?: ThumbnailBackground;
  lastAiThumbnailStyle?: ThumbnailStyle;
}
