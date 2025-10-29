import moment from 'moment';
import {Service} from "typedi";

import IInRequestRepo from "../../../service/i-repos/i-in-request.repo";
import InRequestDataModel from "../../data-model/in-request.data-model";

@Service()
export default class InRequestLocalRepo implements IInRequestRepo {

  private readonly repo = new Array<InRequestDataModel>();

  async newRequest(domainId: string, user: string): Promise<InRequestDataModel> {
    this.repo.push({domainId, user, date: moment().valueOf()});
    return this.repo[this.repo.length - 1];
  }

  async requestsSince(dateLong: number): Promise<InRequestDataModel[]> {
    return [];//todo
  }

}
