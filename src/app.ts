import 'reflect-metadata';
import fs from 'fs';
import express from 'express';

import {audiosFolder, sendMessage} from "./bot/general";
import runBot from "./bot/bot";
import del from "del";
import config from "./config";
import loaders from "./loaders";

//#region open a server port just to show the site and have Heroku host us
const app = express();
app.get('/', (req, res) =>
  fs.readFile('./index.html', 'utf8', (err, html) => {
    if (err) res.status(500).send('Sorry, out of order');
    res.send(html);
  })
);
app.listen(process.env.PORT || 15000, () => sendMessage(config.adminChatId, 'Site is up in ' + config.runningEnv));
//#endregion

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
