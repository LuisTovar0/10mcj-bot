import SimpleUser from "../domain/simple-user";
import SimpleUserDataModel from "../persistence/data-model/simple-user.data-model";

export function domainToDataModel(user: SimpleUser): SimpleUserDataModel {
  return {
    domainId: user.domainId.toString(),
    id: user.id,
    username: user.username,
    chosenPhotoId: user.chosenPhotoId,
    lastThumbnailBackground: user.lastThumbnailBackground,
    lastAiThumbnailStyle: user.lastAiThumbnailStyle,
  };
}

export function dataModelToDomain(
    { domainId, id, username, chosenPhotoId, lastThumbnailBackground, lastAiThumbnailStyle }: SimpleUserDataModel,
): SimpleUser {
  return new SimpleUser({
    id, username, chosenPhotoId, lastThumbnailBackground,
    lastAiThumbnailStyle: lastAiThumbnailStyle && {
      layout: lastAiThumbnailStyle.layout, template: lastAiThumbnailStyle.template, separatorColor: lastAiThumbnailStyle.separatorColor,
    },
  }, domainId);
}
