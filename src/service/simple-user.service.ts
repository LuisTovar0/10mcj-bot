import {Inject, Service} from "typedi";

import config from "../config";
import * as mapper from '../mappers/simple-user.mapper';
import SimpleUser, {SimpleUserProps} from "../domain/simple-user";
import ISimpleUserService from "./iService/i-simpleUser.service";
import ISimpleUserRepo from "./iRepos/i-simple-user.repo";

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

  async getUserByDomainId(domainId: string): Promise<SimpleUser> {
    const dataModel = await this.repo.getByDomainId(domainId);
    if (!dataModel)
      throw new Error(`User with domain ID ${domainId} doesn't exist.`);
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

  async getByUsername(username: string) {
    const dataModel = await this.repo.getByUsername(username);
    if (!dataModel)
      throw new Error(`User with username ${username} doesn't exist.`);
    else
      return mapper.dataModelToDomain(dataModel);
  }

  async choosePhoto(chatId: number, photoId: string): Promise<void> {
    const user = await this.getUserById(chatId);
    user.chosenPhotoId = photoId;
    await this.repo.updateUser(mapper.domainToDataModel(user));
  }

}
