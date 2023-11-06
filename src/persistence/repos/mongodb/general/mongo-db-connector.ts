import mongoose from "mongoose";
import {Container} from "typedi";

import config, {loadEnvVar} from "../../../../config";
import IBotUtilsService from "../../../../service/i-service/telegram-bot/i-bot-utils.service";
import {IDbConnector} from "../../db-connector";

export default class MongoDbConnector implements IDbConnector {

  dbConnected = false;
  connecting = false;
  databaseUrl: string;

  constructor() {
    this.databaseUrl = loadEnvVar('mongodbUrl');
  }

  async connect(noLog?: boolean) {
    if (this.dbConnected) {
      if (!noLog) console.log('was already connected');
      return;
    }
    if (!this.connecting) {
      this.connecting = true;
      await this.connectMongo(noLog);
    }
  }

  async connectMongo(noLog?: boolean): Promise<void> {
    try {
      await mongoose.connect(this.databaseUrl);
      if (!noLog) {
        console.log(`[DB] \u{1F527} Connected to the MongoDB database`);
        try {
          const botUtils = Container.get(config.deps.service.botUtils.name) as IBotUtilsService;
          await botUtils.sendMessage(botUtils.adminChatId, '\u{1F527} Connected to MongoDB');
        } catch (e) {
        }
      }
      this.dbConnected = true;
      this.connecting = false;
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
