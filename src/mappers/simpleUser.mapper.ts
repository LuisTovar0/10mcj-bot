import SimpleUser from "../domain/simpleUser";
import SimpleUserDataModel from "../persistence/dataModel/simpleUser.dataModel";

export function domainToDataModel(user: SimpleUser): SimpleUserDataModel {
  return {
    domainId: user.domainId.toString(),
    id: user.id,
    username: user.username,
    // firstName: user.firstName,
    // lastName: user.lastName
  };
}

export function dataModelToDomain({domainId, id, username/*, firstName, lastName*/}: SimpleUserDataModel): SimpleUser {
  return new SimpleUser({id, username/*, firstname: firstName, lastname: lastName*/}, domainId);
}
