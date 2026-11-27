import { model, Schema } from 'mongoose';
import { Service } from "typedi";

import type { ThumbnailBackground } from "../../../domain/simple-user";
import type { ThumbnailStyle } from "../../../domain/thumbnail-style";
import ISimpleUserRepo from "../../../service/i-repos/i-simple-user.repo";
import SimpleUserDataModel from "../../data-model/simple-user.data-model";
import { MongoRepo } from "./general/mongo-repo";

@Service()
export default class SimpleUserMongoDb extends MongoRepo<SimpleUserDataModel> implements ISimpleUserRepo {

  constructor() {
    super(schema);
  }

  async getByDomainId(id: string): Promise<SimpleUserDataModel | null> {
    return await this.findByDomainId(id);
  }

  async getById(id: number): Promise<SimpleUserDataModel | null> {
    return await this.schema.findOne({ id });
  }

  async save(dataModel: SimpleUserDataModel): Promise<SimpleUserDataModel> {
    return await this.persist(dataModel);
  }

  async getByUsername(username: string): Promise<SimpleUserDataModel | null> {
    return await this.schema.findOne({ username });
  }

  async updateUser(dataModel: SimpleUserDataModel): Promise<void> {
    const { domainId, id, username, chosenPhotoId } = dataModel;
    await this.schema.updateOne({ domainId }, { $set: { id, username, chosenPhotoId } });
  }

  async saveThumbnailPreferences(id: number, background: ThumbnailBackground, style?: ThumbnailStyle): Promise<void> {
    await this.schema.updateOne({ id }, { $set: {
      lastThumbnailBackground: background,
      ...(style && { lastAiThumbnailStyle: style }),
    } });
  }

}

const schema = model<SimpleUserDataModel>(`Simple User`, new Schema({
  domainId: {
    type: String,
    required: [ true, `MongoDB requires a SimpleUser domain ID.` ],
    unique: true,
  },
  id: {
    type: Number,
    required: [ true, `MongoDB requires a SimpleUser chat ID.` ],
    unique: true,
  },
  username: String,
  chosenPhotoId: String,
  lastThumbnailBackground: new Schema({
    kind: { type: String, enum: [ 'built-in', 'gallery', 'telegram' ], required: true },
    id: String,
  }, { _id: false }),
  lastAiThumbnailStyle: new Schema({
    layout: { type: String, enum: [ 'horizontal', 'vertical' ], required: true },
    template: { type: String, enum: [ 'regular', 'special' ], required: true },
    separatorColor: { type: String, required: true },
  }, { _id: false }),
  // firstname: {
  //   type: String,
  //   required: [true, `MongoDB requires a SimpleUser first name.`]
  // },
  // lastname: {
  //   type: String,
  // }
}));
