import UniqueEntityID from "./unique-entity-id";

export default class Entity<T> {

  protected readonly _id: UniqueEntityID;
  protected readonly props: T;

  constructor(props: T, id?: UniqueEntityID | string) {
    if (id) {
      if (<string>id) this._id = new UniqueEntityID(<string>id);
      else this._id = <UniqueEntityID>id;
    } else this._id = new UniqueEntityID();
    this.props = props;
  }

  public equals(object?: Entity<T>): boolean {
    if (object === null)
      return false;
    if (this === object)
      return true;
    if (!(object instanceof Entity))
      return false;
    return this._id.equals(object._id);
  }

  get domainId(): UniqueEntityID {
    return this._id;
  }

}
