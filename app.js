const dotenv = require('dotenv');
const botgram = require('botgram');

if (!dotenv.config()) throw new Error('Could not find .env file!');

const botToken = process.env.BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
if (!botToken || !adminChatId) throw new Error('BOT_TOKEN or ADMIN_CHAT_ID environment variables may not be defined.');
else console.log('your bot token: ' + botToken + '\nthe admin\'s chat ID: ' + adminChatId);

const bot = botgram(botToken);

bot.command("start", function (msg, reply, next) {
  reply.text('Bem-vindo');
});

bot.message(function (msg, reply, next) {
  reply.text("You said:");
  try {
    reply.message(msg);
  } catch (err) {
    reply.text("Couldn't resend that.");
  }
});

const express = require('express');
const app = express();
const requestmaker = require('request');

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(process.env.PORT || 15000, () => {
  sendTextToTelegram(adminChatId, "Bot running");
});
app.use(express.json());

function sendTextToTelegram(chatId, message) {
  message = encodeURI(message);
  const response = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}`;
  console.log('posted: ' + response);
  requestmaker(response);
}

// app.post('/' + botToken, function (request, response) {
//   response.set('Content-Type', 'application/json');
//   console.log(request.body);
//   const userText = request.body.message.text;
//   const chatId = request.body.message.chat.id;
//   sendTextToTelegram(chatId, userText);
//   sendTextToTelegram(chatId, 'lol 😂');
//   response.end();
// });
