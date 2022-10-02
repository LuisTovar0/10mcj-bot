import IInRequestRepo from "../../../service/iRepos/iInRequest.repo";
import {Service} from "typedi";
import InRequestDataModel from "../../dataModel/inRequest.dataModel";

@Service()
export default class InRequestMongoDb implements IInRequestRepo {

  newRequest(req: InRequestDataModel): InRequestDataModel {
    throw new Error('Not implemented');
  }

}