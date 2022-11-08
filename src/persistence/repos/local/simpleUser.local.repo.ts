import SimpleUserDataModel from "../../dataModel/simpleUser.dataModel";

// @Service()
export default class SimpleUserLocalRepo /*implements ISimpleUserRepo*/ {

  private readonly repo = new Array<SimpleUserDataModel>();

  async getByDomainId(id: string): Promise<SimpleUserDataModel | null> {
    const res = this.repo.find(v => v.domainId === id);
    return res ? res : null;
  }

  async getById(id: number): Promise<SimpleUserDataModel | null> {
    const res = this.repo.find(v => v.id === id);
    return res ? res : null;
  }

  async save(dataModel: SimpleUserDataModel): Promise<SimpleUserDataModel> {
    this.repo.push(dataModel);
    return this.repo[this.repo.length - 1];
  }

  async getByUsername(username: string): Promise<SimpleUserDataModel | null> {
    const res = this.repo.find(v => v.username === username);
    return res ? res : null;
  }

}
