import SimpleUserDataModel from "../../persistence/dataModel/simpleUser.dataModel";

export default interface ISimpleUserRepo {

  /**
   * Persist a simple user. If user'd domainId, id, or username already exists, throws exception.
   */
  save(dataModel: SimpleUserDataModel): Promise<SimpleUserDataModel>;

  getByDomainId(id: string): Promise<SimpleUserDataModel | null>;

  getById(id: number): Promise<SimpleUserDataModel | null>;

  getByUsername(username: string): Promise<SimpleUserDataModel | null>;

  updateUser(dataModel: SimpleUserDataModel): Promise<void>;

}