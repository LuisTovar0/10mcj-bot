import del from "del";
import fs from 'fs';
import 'reflect-metadata';
import {Container} from "typedi";
import config from "./config";
import {tempFolder} from "./config/constants";

import loaders from "./loaders";
import server from "./server";
import IBotService from "./service/iService/telegramBot/IBotService";

async function app() {
  loaders();
  server();

  //#region make sure our audios folder exists, or clean it
  async function newCleanFolder(folderName: string) {
    await del(folderName);
    fs.access(folderName, (error) => {
      if (error) fs.mkdir(folderName, (error) => {
        if (error) throw error;
      });
    });
  }

  //#endregion
  await newCleanFolder(tempFolder);

  // set up and run the bot
  const bot = Container.get(config.deps.service.bot.name) as IBotService;
  await bot.run();
}

app();
