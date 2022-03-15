import fs from 'fs';
import express from 'express';
import dotenv from 'dotenv';
import request from 'request';
import botgram from 'botgram';
import textFormatting from "./textFormatting.js";

// the env vars
if (!dotenv.config()) throw new Error('Could not find .env file!');
const botToken = process.env.BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
const runningEnv = process.env.RUNNING_ENV;
if (!botToken || !adminChatId || !runningEnv)
  throw new Error('BOT_TOKEN, ADMIN_CHAT_ID or RUNNING_ENV environment variables may not be defined.');
else console.log('your bot token: ' + botToken + '\nthe admin\'s chat ID: ' + adminChatId);

if (runningEnv.equalsIgnoreCase('production')) {
  sendMessage(adminChatId, 'App was starting in production but stopped.');
  throw new Error('Not meant to be run in production yet.');
}

// have a server just to show the site and have Heroku host us
const app = express();
app.get('/', (req, res) =>
  fs.readFile('./index.html', 'utf8', (err, html) => {
    if (err) res.status(500).send('Sorry, out of order');
    res.send(html);
  })
);
app.listen(process.env.PORT || 15000, () => sendMessage(adminChatId, 'Site is up in ' + runningEnv));

// set up and run the bot
let cache = {};
const bot = botgram(botToken);
bot.command('telegram', (msg, reply, next) => {
  console.log('caught telegram command');
  console.log(msg.chat.id);
  if (!cache[msg.chat.id]) {
    cache[msg.chat.id] = {
      state: 'telegram',
      cache: {
        audio: '',
        text: ''
      }
    };
    reply.text('okapa. manda aí o áudio e o texto');
  } else reply.text('Mano já tinhas mandado isso. Agora tem de ser um áudio e um texto.');
});

bot.command('cancel', (msg, reply, next) => {
  delete cache[msg.chat.id];
  reply.text('Ok irmom 🗿 registos apagados');
});

bot.audio((msg, reply, next) => {
  bot.fileLoad(msg.file, (err, buffer) => {
    if (err) throw err;
    reply.text("Downloaded! Writing to disk...");
    let stream = fs.createWriteStream('./file.mp3');
    stream.write(buffer);
  });
});

bot.text((msg, reply, next) => {
  try {
    let userCache = cache[msg.chat.id].cache;
    console.log(userCache);
    if (userCache.text) {
      reply.text('Mano já tinhas mandado texto, tens de mandar áudio');
      return;
    }
    let textToSend = textFormatting(msg.text);
    reply.markdown(textToSend);
    console.log(textToSend);
  } catch (e) {
    let textToSend = 'Olha só para isto!\n' +
      '```\n' + e.stack + '\n```\nAgora vais sentar-te e pensar no que fizeste...';
    reply.markdown('houve um erro');
    console.log(textToSend);
  }
});

function sendMessage(chatId, message) {
  const text = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURI(message)}`;
  console.log('posted: ' + text);
  request(text);
}

// inform me that it's running
sendMessage(adminChatId, 'Bot is running in ' + runningEnv);
