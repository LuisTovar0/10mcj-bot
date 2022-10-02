import InRequest from "../../../domain/inRequest";
import InRequestDataModel from "../inRequest.dataModel";
import SimpleUser from "../../../domain/simpleUser";

export function domainToDataModel(request: InRequest): InRequestDataModel {
  return {
    domainId: request.domainId.toString(),
    user: request.user.domainId.toString(),
    date: request.formattedDate
  };
}

export function dataModelToDomain(dataModel: InRequestDataModel, user: SimpleUser): InRequest {
  return InRequest.create(user, dataModel.date, dataModel.domainId);
}
