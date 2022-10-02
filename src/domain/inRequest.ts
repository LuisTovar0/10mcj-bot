import moment, {Moment} from "moment";
import SimpleUser from "./simpleUser";
import Entity from "./core/entity";
import UniqueEntityID from "./core/uniqueEntityId";

interface InRequestProps {
  user: SimpleUser;
  date: Moment;
}

export default class InRequest extends Entity<any> {

  public static readonly dateFormat = "YYYYMMDD hh:mm:ss";

  private constructor(props: InRequestProps, id?: UniqueEntityID | string) {
    super(props, id);
  }

  static create(user: SimpleUser, date: string | Moment, id?: UniqueEntityID | string) {
    let d;
    if (<string>date) {
      const strDate = <string>date;
      d = moment(strDate, this.dateFormat, true);
      if (d.format(this.dateFormat) === "Invalid date")
        throw new Error(`Invalid date "${strDate}". Valid format is "${this.dateFormat}".`);
    } else
      d = <Moment>date;

    return new InRequest({user, date: d}, id);
  }

  get user(): SimpleUser {
    return this.props.user;
  }

  get formattedDate(): string {
    return this.props.date.format(InRequest.dateFormat);
  }

  get moment(): Moment {
    return this.props.date;
  }

}