import SimpleUser from "../domain/simple-user";
import SimpleUserDataModel from "../persistence/dataModel/simple-user.data-model";

export function domainToDataModel(user: SimpleUser): SimpleUserDataModel {
  return {
    domainId: user.domainId.toString(),
    id: user.id,
    username: user.username,
    chosenPhotoId: user.chosenPhotoId
  };
}

export function dataModelToDomain({domainId, id, username, chosenPhotoId}: SimpleUserDataModel): SimpleUser {
  return new SimpleUser({id, username, chosenPhotoId}, domainId);
}
