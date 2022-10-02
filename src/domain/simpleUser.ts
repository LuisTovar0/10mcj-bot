import Entity from "./core/entity";
import UniqueEntityID from "./core/uniqueEntityId";

export interface SimpleUserProps {
  id: number;
  username?: string;
  // firstname: string;
  // lastname: string | null;
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

  // get firstName() {
  //   return this.props.firstname;
  // }
  //
  // get lastName() {
  //   return this.props.lastname;
  // }

}
