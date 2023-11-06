import moment from 'moment';
import {Inject, Service} from "typedi";

import config from "../config";
import UniqueEntityID from "../domain/core/unique-entity-id";
import InRequest from "../domain/in-request";
import SimpleUser, {SimpleUserProps} from "../domain/simple-user";
import IInRequestRepo from "./i-repos/i-in-request.repo";
import IInRequestService from "./i-service/i-in-request.service";
import ISimpleUserService from "./i-service/i-simpleUser.service";

type RequestList = {
  user?: string;
  requests: number;
}[];

type AuxRequestList = {
  user: {
    domainId: string;
    username?: string;
    // chatId: number;
  };
  requests: number;
}[];

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

  async getRequestsSince(dateLong: number): Promise<RequestList> {
    const requestDataModels = await this.repo.requestsSince(dateLong);
    const res: AuxRequestList = [];
    for (const req of requestDataModels) {
      const entry = res.find(v => v.user.domainId === req.user);
      if (entry)
        entry.requests += 1;
      else {
        const user = await this.userService.getUserByDomainId(req.user);
        res.push({user: {domainId: user.domainId.toString(), username: user.username}, requests: 1});
      }
    }
    return res.map(v => ({
      requests: v.requests,
      user: v.user.username
    }));
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
