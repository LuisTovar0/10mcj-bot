export default interface IWhitelistRepo {

  isWhitelisted(username: string): Promise<boolean>;

  add(username: string): Promise<void>;

  remove(username: string): Promise<void>;

  fullWhitelist(): Promise<string[]>;

}
