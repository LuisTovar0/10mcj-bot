import IInRequestRepo from "../../../service/iRepos/iInRequest.repo";
import InRequestDataModel from "../../dataModel/inRequest.dataModel";
import {Service} from "typedi";

@Service()
export default class InRequestLocalRepo implements IInRequestRepo {

  private readonly repo = new Array<InRequestDataModel>();

  newRequest(req: InRequestDataModel): InRequestDataModel {
    this.repo.push(req);
    return this.repo[this.repo.length - 1];
  }

}