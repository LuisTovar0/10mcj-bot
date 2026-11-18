import { model, Schema } from "mongoose";
import IListRepo from "../../../../service/i-repos/i-list.repo";
import { isTelegramUserId } from "../../../../service/telegram-bot/telegram-user-id";

export default abstract class ListMongoRepo implements IListRepo {

  private readonly schema;

  protected constructor(collection: string) {
    this.schema = model<{ userId: number }>(collection, new Schema({
      userId: {
        type: Number,
        unique: true,
        required: true,
        validate: isTelegramUserId,
      },
    }), collection);
  }

  async add(userId: number): Promise<void> {
    await this.schema.init();
    await this.schema.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true, runValidators: true });
  }

  async contains(userId: number): Promise<boolean> {
    return !!(await this.schema.exists({ userId }));
  }

  async remove(userId: number): Promise<boolean> {
    return (await this.schema.deleteOne({ userId })).deletedCount > 0;
  }

  async fullList(): Promise<number[]> {
    return (await this.schema.find().sort({ userId: 1 })).map(entry => entry.userId);
  }
}
