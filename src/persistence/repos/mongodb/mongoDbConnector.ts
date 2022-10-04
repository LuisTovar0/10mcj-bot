import mongoose from "mongoose";

import config, {loadEnvVars} from "../../../config";
import {IDbConnector} from "../dbConnector";
import {sendMessage} from "../../../bot/general";

export default class MongoDbConnector implements IDbConnector {

  dbConnected = false;
  databaseUrl: string;

  constructor() {
    this.databaseUrl = loadEnvVars({databaseUrl: ''}).databaseUrl;
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
        sendMessage(config.adminChatId, '\u{1F527} Connected to MongoDB');
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