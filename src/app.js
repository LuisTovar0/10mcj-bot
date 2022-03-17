import fs from 'fs';
import express from 'express';
import del from "del";
import dotenv from 'dotenv';

import {audiosFolder, sendMessage} from "./shared.js";
import runBot from "./bot.js";

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

//#region make sure our audios folder exists, or clean it
await del(audiosFolder);
fs.access(audiosFolder, (error) => {
  if (error) fs.mkdir(audiosFolder, (error) => {
    if (error) throw error;
  });
});
//#endregion

// set up and run the bot
runBot(botToken, adminChatId);

// inform me that it's running
sendMessage(adminChatId, 'Bot is running in ' + runningEnv);
