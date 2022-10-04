import moment, {Moment} from "moment";
import SimpleUser from "./simpleUser";
import Entity from "./core/entity";
import UniqueEntityID from "./core/uniqueEntityId";

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

  static create(user: SimpleUser, date: string | number | Moment, id?: UniqueEntityID | string) {
    let d;
    if (<string>date) {
      const strDate = <string>date;
      d = moment(strDate, this.dateFormat, true);
      if (d.format(this.dateFormat) === "Invalid date")
        throw new Error(`Invalid date "${strDate}". Valid format is "${this.dateFormat}".`);
    } else if (<number>date)
      d = moment(<number>date);
    else
      d = <Moment>date;

    return new InRequest({user, date: d}, id);
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