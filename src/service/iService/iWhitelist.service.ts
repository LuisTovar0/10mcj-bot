export default interface IWhitelistService {

  isWhitelisted(chatId: number): Promise<boolean>;

  add(chatId: number): Promise<void>;

  remove(chatId: number): Promise<void>;

}
