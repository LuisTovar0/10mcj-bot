import SimpleUser, { SimpleUserProps, ThumbnailBackground } from "../../domain/simple-user";
import type { ThumbnailStyle } from "../../domain/thumbnail-style";

export default interface ISimpleUserService {

  addUser(props: SimpleUserProps): Promise<SimpleUser>;

  getUserByDomainId(id: string): Promise<SimpleUser>;

  getUserById(id: number): Promise<SimpleUser>;

  getByUsername(username: string): Promise<SimpleUser>;

  choosePhoto(chatId: number, photoId: string): Promise<void>;

  saveThumbnailPreferences(chatId: number, background: ThumbnailBackground, style?: ThumbnailStyle): Promise<void>;

}
