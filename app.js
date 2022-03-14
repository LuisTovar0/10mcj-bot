// have a server just to show the site and have Heroku host us
const express = require('express');
const app = express();
app.use('/', express.static('./'));

// the env vars
if (!require('dotenv').config()) throw new Error('Could not find .env file!');
const botToken = process.env.BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
if (!botToken || !adminChatId) throw new Error('BOT_TOKEN or ADMIN_CHAT_ID environment variables may not be defined.');
else console.log('your bot token: ' + botToken + '\nthe admin\'s chat ID: ' + adminChatId);

// the bot
const bot = require('botgram')(botToken);
bot.message((msg, reply, next) => {
  reply.text(msg.text);
  reply.text('lol what are you saying');
});
