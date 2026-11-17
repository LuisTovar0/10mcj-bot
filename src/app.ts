import { mkdir, rm } from 'node:fs/promises';
import 'reflect-metadata';
import { Container } from "typedi";
import config from "./config";
import { tempFolder } from "./config/constants";

import loaders from "./loaders";
import server from "./server";
import IBotService from "./service/i-service/telegram-bot/i-bot-service";

async function app() {
  loaders();
  server();

  //make sure our audios folder exists, or clean it
  async function newCleanFolder(folderName: string) {
    await rm(folderName, { recursive: true, force: true });
    await mkdir(folderName, { recursive: true });
  }

  await newCleanFolder(tempFolder);

  // set up and run the bot
  const bot = Container.get(config.deps.service.bot.name) as IBotService;
  await bot.run();
}

app();
