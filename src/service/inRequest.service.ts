import {Inject, Service} from "typedi";
import moment from 'moment';

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

  async getRequestsSince(dateLong: number) {
    const requestDataModels = await this.repo.requestsSince(dateLong);
    const res: { user: { domainId: string, username?: string }, requests: number }[] = [];
    for (const req of requestDataModels) {
      const entry = res.find(v => v.user.domainId === req.user);
      if (entry) entry.requests += 1;
      else {
        const user = await this.userService.getUserByDomainId(req.user);
        res.push({user: {domainId: user.domainId.toString(), username: user.username}, requests: 1});
      }
    }
    return res.map(v => {
      return {
        requests: v.requests,
        user: v.user.username
      };
    });
  }

  getLastMonthRequests() {
    const aMonthAgo = moment().subtract(1, 'month').valueOf();
    return this.getRequestsSince(aMonthAgo);
  }

  getLast15DaysRequests() {
    const twoWeeksAgo = moment().subtract(15, 'days').valueOf();
    return this.getRequestsSince(twoWeeksAgo);
  }

  getLastWeekRequests() {
    const aWeekAgo = moment().subtract(1, 'week').valueOf();
    return this.getRequestsSince(aWeekAgo);
  }

}
