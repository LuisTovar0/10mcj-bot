import fs from 'fs';
import express from 'express';
import del from "del";
import botgram from 'botgram';
import {EventEmitter} from 'events';
import dotenv from 'dotenv';

import textFormatting from "./textFormatting.js";
import {saveAudio} from "./audio.js";
import {audiosFolder, sendMessage, wrapper} from "./constants.js";

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
let memory = {};
const bot = botgram(botToken);
bot.command('start', (msg, reply) => {
  reply.text('Olá. com o que vamos começar?\n' +
    '/telegram para formatar uma mensagem para o Telegram');
});

bot.command('mystatus', async (msg, reply) =>
  await wrapper(reply, () => reply.text(JSON.stringify(memory[msg.chat.id] || {})))
);

bot.command('telegram', async (msg, reply) => {
  await wrapper(reply, () => {
    if (!memory[msg.chat.id]) {
      memory[msg.chat.id] = {
        state: 'telegram',
        data: {
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
    await deleteUserData(msg.chat.id);
    reply.text('Ok irmom 🗿 registos apagados');
  });
});

async function deleteUserData(chatId) {
  // delete audio if exists
  await del(audiosFolder + chatId);
  // delete tracked information
  delete memory[chatId];
}

bot.audio(async (msg, reply) => {
  await wrapper(reply, () => {
    const chatId = msg.chat.id;
    if (memory[chatId] !== undefined) { // /telegram command was used
      if (!memory[chatId].data.audio) { // audio hasn't been sent
        reply.text('péràí');
        const eventEmitter = new EventEmitter();
        eventEmitter.on('finished', async () => {
          // to be executed after the audio download
          memory[chatId].data.audio = true;
          reply.text('já tá. ganda meditação');
          if (memory[chatId].data.text) await joinAudioAndText(chatId, reply);
        });
        saveAudio(bot, msg.file, audiosFolder + chatId, eventEmitter);
      } else reply.text('já tinhas mandado áudio. manda aí texto');
    } else reply.text('só processo áudios para serem mandados para o Telegram, por isso tens de usar o comando /telegram primeiro');
  });
});

bot.text(async (msg, reply) => {
  await wrapper(reply, async () => {
    let info = memory[msg.chat.id];
    if (info) {
      console.log(info.data);
      if (info.data.text)
        throw new Error('já tinhas mandado texto, agora tens de mandar áudio');
      memory[msg.chat.id].data.text = textFormatting(msg.text);
      await joinAudioAndText(msg.chat.id, reply);
    } else {
      let textToSend = textFormatting(msg.text);
      reply.sendGeneric("sendMessage",
        {text: textToSend, parse_mode: "Markdown", disable_web_page_preview: true});
    }
  });
});

async function joinAudioAndText(chatId, reply) {
  const textToSend = memory[chatId].data.text;
  const toSendSplit = textToSend.split('\n');
  const badTitle = toSendSplit[2];
  const title = badTitle.substring(badTitle.indexOf(' ') + 1, badTitle.length - 1);
  const file = fs.createReadStream(audiosFolder + chatId);
  reply.sendGeneric("sendAudio",
    {audio: file, performer: toSendSplit[0], title: title, caption: textToSend, parse_mode: 'Markdown'});
  await deleteUserData(chatId);
}

bot.command('debug', async (msg, reply) => {
  await wrapper(reply, () => {
    if (msg.chat.id.toString() !== adminChatId.toString()) {
      sendMessage(adminChatId, 'user @' + msg.chat.username + ' tried to use debug');
      throw new Error('not allowed. this situation will be reported to my master.');
    }

    reply.text('nothin\'s testin');
  });
});

// inform me that it's running
sendMessage(adminChatId, 'Bot is running in ' + runningEnv);
