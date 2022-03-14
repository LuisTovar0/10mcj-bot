import express from 'express';
import dotenv from 'dotenv';
import request from 'request';
import botgram from 'botgram';

// have a server just to show the site and have Heroku host us
const app = express();
app.use('/', express.static('./'));

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
  let split = msg.text.split('\n');
  if (split.length < 3) {
    reply.text('bad message');
    return;
  }
  let url = split[0], desc = split[2],
    date = new Date(), month = date.getMonth();

  reply.markdown(date.getDate() + '-' + (month < 10 ? '0' + month : month) + '-' + date.getFullYear().toString().substring(2, 4) +
    '\n\n__' + desc + '__\n\n[▶️ YouTube](' + url + ')          [🌐 +Info](https://10minutoscomjesus.org/)');
});

function sendMessage(chatId, message) {
  const text = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURI(message)}`;
  console.log('posted: ' + text);
  request(text);
}

// inform me that it's running
sendMessage(adminChatId, 'Bot is running');
