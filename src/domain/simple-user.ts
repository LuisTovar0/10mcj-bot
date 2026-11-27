import Entity from "./core/entity";
import UniqueEntityID from "./core/unique-entity-id";
import type { ThumbnailStyle } from "./thumbnail-style";

export type ThumbnailBackground =
  | { kind: 'built-in' }
  | { kind: 'gallery'; id: string }
  | { kind: 'telegram'; id: string };

export interface SimpleUserProps {
  id: number;
  username?: string;
  chosenPhotoId?: string;
  lastThumbnailBackground?: ThumbnailBackground;
  lastAiThumbnailStyle?: ThumbnailStyle;
}

export default class SimpleUser extends Entity<SimpleUserProps> {

  constructor(props: SimpleUserProps, id?: UniqueEntityID | string) {
    super(props, id);
  }

  get id() {
    return this.props.id;
  }

  get username() {
    return this.props.username;
  }

  get chosenPhotoId() {
    return this.props.chosenPhotoId;
  }

  set chosenPhotoId(value: string | undefined) {
    this.props.chosenPhotoId = value;
  }

  get lastThumbnailBackground() {
    return this.props.lastThumbnailBackground;
  }

  get lastAiThumbnailStyle() {
    return this.props.lastAiThumbnailStyle;
  }

}
