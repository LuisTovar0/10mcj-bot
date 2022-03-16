import request from "request";

export const audiosFolder = './audios/';

const errorMsgs = [
  '🤨😑😑😑 iss nã dê',
  'O QUE É QUE FIZESTE?!? 😭😭😭',
  'Deves ter partido alguma coisa',
  'Isso não funcionou. Desculpa lá',
];

// to make sure exceptions are handled so the bot doesn't stop on errors
export async function wrapper(reply, call) {
  try {
    await call();
  } catch (e) {
    reply.text(errorMsgs[Math.round(Math.random()) % errorMsgs.length]);
    reply.text(e.message);
    console.log(e.stack);
  }
}

export function sendMessage(chatId, message) {
  const text = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURI(message)}`;
  console.log('posted: ' + text);
  request(text);
}
