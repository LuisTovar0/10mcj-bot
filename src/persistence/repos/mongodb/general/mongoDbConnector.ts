import mongoose from "mongoose";

import {loadEnvVar} from "../../../../config";
import {IDbConnector} from "../../dbConnector";
import {sendMessage} from "../../../../bot/general";
import bot from "../../../../bot";

export default class MongoDbConnector implements IDbConnector {

  dbConnected = false;
  databaseUrl: string;

  constructor() {
    this.databaseUrl = loadEnvVar('mongodbUrl');
  }

  async connect(noLog?: boolean) {
    if (this.dbConnected) {
      if (!noLog) console.log('was already connected');
      return;
    }
    await this.connectMongo(noLog);
  }

  async connectMongo(noLog?: boolean): Promise<void> {
    try {
      await mongoose.connect(this.databaseUrl);
      if (!noLog) {
        console.log(`[DB] \u{1F527} Connected to the MongoDB database`);
        await sendMessage(bot.adminChatId, '\u{1F527} Connected to MongoDB');
      }
      this.dbConnected = true;
    } catch (e) {
      if (!noLog) console.log(`[DB] Could not connect to MongoDB: ${e.message}\n\tWaiting 5s until next try`);

      await new Promise(r => setTimeout(r, 5000));
      await this.connectMongo();
    }
  }

  async disconnect() {
    await mongoose.disconnect();
  }

}