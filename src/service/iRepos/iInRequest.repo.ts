import InRequestDataModel from "../../persistence/dataModel/inRequest.dataModel";

export default interface IInRequestRepo {

  newRequest(req: InRequestDataModel): InRequestDataModel;

}
