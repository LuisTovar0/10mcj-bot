import {readFile} from 'fs';
import express from 'express';
import dotenv from 'dotenv';
import request from 'request';
import botgram from 'botgram';

// have a server just to show the site and have Heroku host us
const app = express();
app.get('/', (req, res) =>
  readFile('./index.html', 'utf8', (err, html) => {
    if (err) res.status(500).send('Sorry, out of order');
    res.send(html);
  })
);
app.listen(process.env.PORT || 15000, () => sendMessage(adminChatId, "Site is up"));

// the env vars
if (!dotenv.config()) throw new Error('Could not find .env file!');
const botToken = process.env.BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
if (!botToken || !adminChatId)
  throw new Error('BOT_TOKEN or ADMIN_CHAT_ID environment variables may not be defined.');
else console.log('your bot token: ' + botToken + '\nthe admin\'s chat ID: ' + adminChatId);

// run the bot
const bot = botgram(botToken);
bot.message((msg, reply, next) => {
  try {
    let split = msg.text.split('\n');
    if (split.length < 3) {
      reply.text('bad message: should have 3 paragraphs');
      return;
    }
    let url = split[0].trim(), desc = split[2].replace('*', '').replace('*', '').trim(),
      date = new Date(), day = date.getDay(), month = date.getMonth() + 1;
    if (date.getHours() > 10) {
      let tomorrow = new Date();
      tomorrow.setDate(date.getDate() + 1);
      day = tomorrow.getDate();
    }

    let textToSend = day + '-' + (month < 10 ? '0' : '') + month + '-' + date.getFullYear().toString().substring(2, 4) +
      '\n\n*' + desc + '*\n\n[▶️ YouTube](' + url + ')          [🌐 +Info](https://10minutoscomjesus.org/)';
    reply.markdown(textToSend);
    console.log(textToSend);
  } catch (e) {
    let textToSend = 'Olha só para isto!\n' +
      '```\n' + e.stack + '\n```\nAgora vais sentar-te e pensar no que fizeste..!';
    reply.markdown(textToSend);
    console.log(textToSend);
  }
});

function sendMessage(chatId, message) {
  const text = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURI(message)}`;
  console.log('posted: ' + text);
  request(text);
}

// inform me that it's running
sendMessage(adminChatId, 'Bot is running');
