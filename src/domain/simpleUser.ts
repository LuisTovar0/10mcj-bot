import Entity from "./core/entity";
import UniqueEntityID from "./core/uniqueEntityId";

export interface SimpleUserProps {
  id: number;
  username?: string;
  chosenPhotoId?: string;
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

}
