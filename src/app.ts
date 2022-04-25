import fs from 'fs';
import express from 'express';
import dotenv from 'dotenv';

import {audiosFolder, sendMessage} from "./shared";
import runBot from "./bot";
import del from "del";

//#region the env vars
if (!dotenv.config()) throw new Error('Could not find .env file!');
const botToken = process.env.BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
const runningEnv = process.env.RUNNING_ENV;
if (!botToken || !adminChatId || !runningEnv)
  throw new Error('BOT_TOKEN, ADMIN_CHAT_ID or RUNNING_ENV environment variables may not be defined.');
else console.log('your bot token: ' + botToken + '\nthe admin\'s chat ID: ' + adminChatId);
//#endregion

//#region have a server just to show the site and have Heroku host us
const app = express();
app.get('/', (req, res) =>
  fs.readFile('./index.html', 'utf8', (err, html) => {
    if (err) res.status(500).send('Sorry, out of order');
    res.send(html);
  })
);
app.listen(process.env.PORT || 15000, () => sendMessage(adminChatId, 'Site is up in ' + runningEnv));
//#endregion

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
runBot(botToken, adminChatId, runningEnv);

// inform me that it's running
sendMessage(adminChatId, 'Bot is running in ' + runningEnv);
