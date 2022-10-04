import moment from 'moment';
import {Service} from "typedi";

import IInRequestRepo from "../../../service/iRepos/iInRequest.repo";
import InRequestDataModel from "../../dataModel/inRequest.dataModel";

@Service()
export default class InRequestLocalRepo implements IInRequestRepo {

  private readonly repo = new Array<InRequestDataModel>();

  async newRequest(domainId: string, user: string): Promise<InRequestDataModel> {
    this.repo.push({domainId, user, date: moment().valueOf()});
    return this.repo[this.repo.length - 1];
  }

  async requestsLast15Days(): Promise<InRequestDataModel[]> {
    throw new Error('not implemented');
  }

  async requestsLastMonth(): Promise<InRequestDataModel[]> {
    throw new Error('not implemented');
  }

  async requestsLastWeek(): Promise<InRequestDataModel[]> {
    throw new Error('not implemented');
  }

}