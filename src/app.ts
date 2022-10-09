import 'reflect-metadata';
import fs from 'fs';

import {audiosFolder, sendMessage} from "./bot/general";
import runBot from "./bot/bot";
import del from "del";
import config from "./config";
import loaders from "./loaders";

loaders();

// make sure our audios folder exists, or clean it
async function newCleanFolder(folderName: string) {
  await del(folderName);
  fs.access(folderName, (error) => {
    if (error) fs.mkdir(folderName, (error) => {
      if (error) throw error;
    });
  });
}

newCleanFolder(audiosFolder);

// set up and run the bot
runBot();

// inform me that it's running
sendMessage(config.adminChatId, 'Bot is running in ' + config.runningEnv);
