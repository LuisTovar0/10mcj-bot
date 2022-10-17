export default interface IWhitelistService {

  isWhitelisted(username: string): Promise<boolean>;

  add(username: string): Promise<void>;

  remove(username: string): Promise<void>;

}
