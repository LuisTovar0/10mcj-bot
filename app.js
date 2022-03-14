const dotenv = require('dotenv');
const botgram = require('botgram');

if (!dotenv.config()) throw new Error('Could not find .env file!');

const botToken = process.env.BOT_TOKEN;
if (!botToken) throw new Error('BOT_TOKEN environment variable is not defined.');
else console.log('your bot token: ' + botToken);

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