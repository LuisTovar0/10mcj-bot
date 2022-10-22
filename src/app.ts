import 'reflect-metadata';
import fs from 'fs';
import del from "del";

import bot from "./bot";
import loaders from "./loaders";
import {tempFolder} from "./config/constants";

async function app() {
  loaders();

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
  await bot.run();
}

app();
