import 'reflect-metadata';
import {Container} from "typedi";
import fs from 'fs';
import del from "del";

import loaders from "./loaders";
import server from "./server";
import {tempFolder} from "./config/constants";
import config from "./config";
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
