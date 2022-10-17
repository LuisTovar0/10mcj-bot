export default interface IListRepo {

  contains(username: string): Promise<boolean>;

  add(username: string): Promise<void>;

  remove(username: string): Promise<void>;

  fullList(): Promise<string[]>;

}
