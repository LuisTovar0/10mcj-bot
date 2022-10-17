import SimpleUser, {SimpleUserProps} from "../../domain/simpleUser";

export default interface ISimpleUserService {

  addUser(props: SimpleUserProps): Promise<SimpleUser>;

  getUserByDomainId(id: string): Promise<SimpleUser>;

  getUserById(id: number): Promise<SimpleUser>;

  getByUsername(username: string): Promise<SimpleUser>;

}