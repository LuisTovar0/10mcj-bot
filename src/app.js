import fs from 'fs';
import express from 'express';
import del from "del";
import dotenv from 'dotenv';
import request from 'request';
import botgram from 'botgram';

import textFormatting from "./textFormatting.js";
import audio from "./audio.js";

// the env vars
if (!dotenv.config()) throw new Error('Could not find .env file!');
const botToken = process.env.BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
const runningEnv = process.env.RUNNING_ENV;
if (!botToken || !adminChatId || !runningEnv)
  throw new Error('BOT_TOKEN, ADMIN_CHAT_ID or RUNNING_ENV environment variables may not be defined.');
else console.log('your bot token: ' + botToken + '\nthe admin\'s chat ID: ' + adminChatId);

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
bot.command('start', (msg, reply) => {
  reply.text('Olá. com o que vamos começar?\n' +
    '/telegram uma mensagem para o Telegram');
});

bot.command('mystatus', async (msg, reply) => {
  await wrapper(reply, () =>
    reply.text(JSON.stringify(cache[msg.chat.id] || {}))
  );
});

bot.command('telegram', async (msg, reply) => {
  await wrapper(reply, () => {
    if (!cache[msg.chat.id]) {
      cache[msg.chat.id] = {
        state: 'telegram',
        cache: {
          audio: false,
          text: ''
        }
      };
      reply.text('okapa. manda aí o áudio e o texto');
    } else reply.text('Mano já tinhas mandado isso. Agora tem de ser um áudio e um texto.');
  });
});

bot.command('cancel', async (msg, reply) => {
  await wrapper(reply, async () => {
    const chatId = msg.chat.id;
    let info = cache[chatId];
    // delete audio if exists
    await del('./' + chatId);
    // delete tracked information
    delete cache[chatId];
    reply.text('Ok irmom 🗿 registos apagados');
  });
});

bot.audio(async (msg, reply) => {
  await wrapper(reply, () => {
    audio(bot, msg);
    if (cache[msg.chat.id])
      cache[msg.chat.id].cache.audio = true;
    reply.text('ganda meditação');
  });
});

bot.text(async (msg, reply) => {
  await wrapper(reply, () => {
    let info = cache[msg.chat.id];
    if (info) {
      let userCache = cache[msg.chat.id].cache;
      console.log(userCache);
      if (userCache.text) throw new Error('Mano já tinhas mandado texto, tens de mandar áudio');
    }
    let textToSend = textFormatting(msg.text);
    reply.markdown(textToSend);
    console.log(textToSend);
  });
});

bot.command('debug', async (msg, reply) => {
  await wrapper(reply, () => {
    if (msg.chat.id.toString() !== adminChatId.toString()) {
      sendMessage(adminChatId, 'user @' + msg.chat.username + ' tried to use debug');
      throw new Error('not allowed. this situation will be reported to my master.');
    }

    reply.text('nothin\'s testin');
  });
});

const msgs = ['🤨😑😑😑 iss nã dê', 'O QUE É QUE FIZESTE?!? 😭😭😭', 'Deves ter partido alguma coisa', 'Isso não funcionou. Desculpa lá',];

// to make sure exceptions are handled so the bot doesn't stop on errors
async function wrapper(reply, call) {
  try {
    await call();
  } catch (e) {
    reply.text(msgs[Math.round(Math.random()) % msgs.length]);
    reply.text(e.message);
    console.log(e.stack);
  }
}

function sendMessage(chatId, message) {
  const text = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURI(message)}`;
  console.log('posted: ' + text);
  request(text);
}

// inform me that it's running
sendMessage(adminChatId, 'Bot is running in ' + runningEnv);
