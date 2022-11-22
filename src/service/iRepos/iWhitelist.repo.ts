import IListRepo from "./iList.repo";

export default interface IWhitelistRepo extends IListRepo {

  usernameIsAllowed(username?: string): Promise<void>;

  chatIdIsAllowed(chatId: number): Promise<void>;

}
