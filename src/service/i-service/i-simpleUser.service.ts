import SimpleUser, {SimpleUserProps} from "../../domain/simple-user";

export default interface ISimpleUserService {

  addUser(props: SimpleUserProps): Promise<SimpleUser>;

  getUserByDomainId(id: string): Promise<SimpleUser>;

  getUserById(id: number): Promise<SimpleUser>;

  getByUsername(username: string): Promise<SimpleUser>;

  choosePhoto(chatId: number, photoId: string): Promise<void>;

}
