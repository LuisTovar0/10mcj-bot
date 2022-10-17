export default interface IWhitelistRepo {

  isWhitelisted(chatId: number): Promise<boolean>;

  add(chatId: number): Promise<void>;

  remove(chatId: number): Promise<void>;

}
