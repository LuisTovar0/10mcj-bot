import ISimpleUserRepo from "../../../service/iRepos/iSimpleUser.repo";
import {Service} from "typedi";
import SimpleUserDataModel from "../../dataModel/simpleUser.dataModel";

@Service()
export default class SimpleUserLocalRepo implements ISimpleUserRepo {

  private readonly repo = new Array<SimpleUserDataModel>();

  async getByDomainId(id: string): Promise<SimpleUserDataModel | undefined> {
    return this.repo.find(v => v.domainId === id);
  }

  async getById(id: number): Promise<SimpleUserDataModel | undefined> {
    return this.repo.find(v => v.id === id);
  }

  async save(dataModel: SimpleUserDataModel): Promise<SimpleUserDataModel> {
    this.repo.push(dataModel);
    return this.repo[this.repo.length - 1];
  }

}