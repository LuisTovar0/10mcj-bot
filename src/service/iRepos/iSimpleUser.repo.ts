import SimpleUserDataModel from "../../persistence/dataModel/simpleUser.dataModel";

export default interface ISimpleUserRepo {

  save(dataModel: SimpleUserDataModel): Promise<void>;

  getByDomainId(id: string): Promise<SimpleUserDataModel | undefined>;

  getById(id: number): Promise<SimpleUserDataModel | undefined>;

}