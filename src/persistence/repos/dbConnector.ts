import config from "../../config";
import MongoDbConnector from "./mongodb/mongoDbConnector";

// Singleton
export default class DbConnector {

  v: IDbConnector;

  private constructor() {
    switch (config.dbType) {
      case 'local':
        this.v = {
          dbConnected: true,
          connect: async noLog => {
            if (!noLog)
              console.log(`[DB] local`);
          },
          disconnect: async () => {
          }
        };
        break;
      case 'mongodb':
        this.v = new MongoDbConnector();
        break;
      default:
        throw new Error(`DB_TYPE ${config.dbType} is invalid.`);
    }
  }

  private static instance: DbConnector | null = null;

  public static getInstance(): IDbConnector {
    if (this.instance === null)
      this.instance = new DbConnector();
    return this.instance.v;
  }

}

export interface IDbConnector {
  dbConnected: boolean;
  connect: (noLog?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
}
