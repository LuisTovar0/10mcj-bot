import {Inject, Service} from "typedi";

import config from "../config";
import * as mapper from '../persistence/dataModel/mappers/inRequest.mapper';
import IInRequestService from "./iService/iInRequest.service";
import InRequest from "../domain/inRequest";
import IInRequestRepo from "./iRepos/iInRequest.repo";
import ISimpleUserService from "./iService/iSimpleUser.service";
import SimpleUser, {SimpleUserProps} from "../domain/simpleUser";

@Service()
export default class InRequestService implements IInRequestService {

  constructor(
    @Inject(config.deps.repo.inRequest.name) private repo: IInRequestRepo,
    @Inject(config.deps.service.simpleUser.name) private userService: ISimpleUserService
  ) {
  }

  async addInRequest(userProps: SimpleUserProps, date: string): Promise<InRequest> {
    let user: SimpleUser;
    try {
      user = await this.userService.getUserById(userProps.id);
    } catch (e) {
      user = await this.userService.addUser(userProps);
    }
    const request = InRequest.create(user, date);
    const persistedDataModel = this.repo.newRequest(mapper.domainToDataModel(request));
    return mapper.dataModelToDomain(persistedDataModel, user);
  }

}
