export default interface IListRepo {

  contains(userId: number): Promise<boolean>;

  add(userId: number): Promise<void>;

  remove(userId: number): Promise<boolean>;

  fullList(): Promise<number[]>;

}
