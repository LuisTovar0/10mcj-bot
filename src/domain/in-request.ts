import moment, {Moment} from "moment";
import SimpleUser from "./simple-user";
import Entity from "./core/entity";
import UniqueEntityID from "./core/unique-entity-id";

interface InRequestProps {
  user: SimpleUser;
  date: Moment;
}

export default class InRequest extends Entity<InRequestProps> {

  public static readonly dateFormat = "YYYYMMDD hh:mm:ss";

  private constructor(props: InRequestProps, id?: UniqueEntityID | string) {
    super(props, id);
  }

  static dateEquals(date1: number, date2: number) {
    return Math.abs(date1 - date2) < 3_000;
  }

  static create(user: SimpleUser, date: number | Moment, id?: UniqueEntityID | string) {
    return new InRequest({user, date: moment(date)}, id);
  }

  get user(): SimpleUser {
    return this.props.user;
  }

  get formattedDate(): string {
    return this.props.date.format(InRequest.dateFormat);
  }

  get dateLong(): number {
    return this.props.date.valueOf();
  }

  get moment(): Moment {
    return this.props.date;
  }

}
