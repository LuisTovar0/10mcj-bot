import {Inject, Service} from "typedi";

import config from "../config";
import * as mapper from '../persistence/dataModel/mappers/simpleUser.mapper';
import SimpleUser, {SimpleUserProps} from "../domain/simpleUser";
import ISimpleUserService from "./iService/iSimpleUser.service";
import ISimpleUserRepo from "./iRepos/iSimpleUser.repo";

@Service()
export default class SimpleUserService implements ISimpleUserService {

  constructor(
    @Inject(config.deps.repo.simpleUser.name) private repo: ISimpleUserRepo
  ) {
  }

  async addUser(props: SimpleUserProps): Promise<SimpleUser> {
    try {
      await this.getUserById(props.id);
    } catch (e) {
      // if user doesn't exist
      const user = new SimpleUser(props);
      const dataModel = mapper.domainToDataModel(user);
      const persistedDataModel = await this.repo.save(dataModel);
      if (!persistedDataModel) throw new Error(`Could not save user.`);
      return mapper.dataModelToDomain(persistedDataModel);
    }
    throw new Error(`User ${props.id}@${props.username} has been added already.`);
  }

  async getUserByDomainId(id: string): Promise<SimpleUser> {
    const dataModel = await this.repo.getByDomainId(id);
    if (!dataModel)
      throw new Error(`User with domain ID ${id} doesn't exist.`);
    else
      return mapper.dataModelToDomain(dataModel);
  }

  async getUserById(id: number): Promise<SimpleUser> {
    const dataModel = await this.repo.getById(id);
    if (!dataModel)
      throw new Error(`User with ID ${id} doesn't exist.`);
    else
      return mapper.dataModelToDomain(dataModel);
  }

}
