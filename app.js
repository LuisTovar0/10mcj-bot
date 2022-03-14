const dotenv = require('dotenv');
const botgram = require('botgram');

if (!dotenv.config()) throw new Error('Could not find .env file!');

const botToken = process.env.BOT_TOKEN;
if (!botToken) throw new Error('BOT_TOKEN environment variable is not defined.');
else console.log('your bot token: ' + botToken);

const bot = botgram(botToken);

bot.command("start", function (msg, reply, next) {
  console.log("Received a /start command from", msg.from.username);
});

bot.text(function (msg, reply, next) {
  console.log("Received a text message:", msg.text);
});
