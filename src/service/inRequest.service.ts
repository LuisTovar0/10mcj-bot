import {Inject, Service} from "typedi";

import config from "../config";
import IInRequestService from "./iService/iInRequest.service";
import InRequest from "../domain/inRequest";
import IInRequestRepo from "./iRepos/iInRequest.repo";
import ISimpleUserService from "./iService/iSimpleUser.service";
import SimpleUser, {SimpleUserProps} from "../domain/simpleUser";
import UniqueEntityID from "../domain/core/uniqueEntityId";

@Service()
export default class InRequestService implements IInRequestService {

  constructor(
    @Inject(config.deps.repo.inRequest.name) private repo: IInRequestRepo,
    @Inject(config.deps.service.simpleUser.name) private userService: ISimpleUserService
  ) {
  }

  async addInRequest(userProps: SimpleUserProps): Promise<InRequest> {
    let user: SimpleUser;
    try {
      user = await this.userService.getUserById(userProps.id);
    } catch (e) {
      user = await this.userService.addUser(userProps);
    }
    const persistedDataModel = await this.repo.newRequest(new UniqueEntityID().toString(), user.domainId.toString());
    return InRequest.create(user, persistedDataModel.date, persistedDataModel.domainId);
  }

}
