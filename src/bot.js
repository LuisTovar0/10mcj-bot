import fs from "fs";
import {EventEmitter} from "events";
import del from "del";
import botgram from "botgram";

import {saveAudio} from "./audio.js";
import {audiosFolder, sendMessage} from "./shared.js";
import {textFormattingPT} from "./textFormatting.js";

export default (botToken, adminChatId) => {

  const memory = {};
  const bot = botgram(botToken);

  //#region commands

  //#region info commands
  bot.command(`start`, (msg, reply) => reply.text(`Welcome, fellow 10MwJ admin!\nBem-vindo, co-administrador dos 10McJ!\n\
 Bienvenido, administrador de 10McJ!`));

  bot.command(`info`, (msg, reply) => reply.text(`/info_en instructions\n/info_pt instruções\n/info_es instrucciones`));

  bot.command(`info_pt`, (msg, reply) => reply.text(`Usa /pt para eu fazer uma formatação. Vais ter de enviar um texto\
 e um áudio separadamente, por qualquer ordem, e eu respondo com tudo formatado.\n\nSempre que estiver confuso, usa\
 /cancel; isso vai apagar todos os registos feitos sobre o chat contigo, para poderes começar de novo.\n\nPara saberes\
 que informações estão guardadas sobre o teu chat, /mystatus`));

  bot.command(`info_en`, (msg, reply) => reply.markdown(`*Formatting for English 10MwJ is not yet implemented.*\n\n\
 Use /en for a formatting. You should send a text and an audio separately, in any order, and I'll respond with the formats.\
 \n\nIf it gets confusing, use /cancel; that'll delete all records of your chat with the bot.\n\nTo know what is recorded\
 about your chat, /mystatus`));

  bot.command(`info_es`, (msg, reply) => reply.markdown(`*Formatación para 10McJ España no está todavía implementada.*\n\n\
 Usa /es para una formatación. Debes enviar un texto y un audio separadamente, en cualquier orden, y respondré con las \
 formataciones.\n\nCuando esté confuso, usa /cancel; eso va a apagar todos los registros del bot con tu chat, para que \
 puedas empezar de nuevo.\n\nPara saber lo que grabó el bot sobre tu chat, /mystatus`));

  bot.command(`mystatus`, (msg, reply) => reply.text(JSON.stringify(memory[msg.chat.id] || {}, null, 3)));
  //#endregion

  bot.command(`pt`, async (msg, reply) => await wrapper(reply, () => {
    if (!memory[msg.chat.id]) {
      memory[msg.chat.id] = {
        command: `pt`,
        data: {
          audio: false,
          text: ``
        }
      };
      reply.text(`okapa. que venham o áudio e o texto`);
    } else reply.text(`Já tinhas declarado o comando. Agora tem de ser um áudio e um texto, separados. Se não quiseres podes usar /cancel`);
  }));

  bot.command(`en`, (mag, reply) => reply.text(`_*Not yet implemented*_`));
  bot.command(`es`, (msg, reply) => reply.text(`_*Aun no implementado*_`));

  bot.command(`cancel`, (msg, reply) => wrapper(reply, async () => {
    await deleteUserData(msg.chat.id);
    reply.text(`Ok irmom \u{1F5FF} registos apagados`);
  }));
  //#endregion

  //#region message treatment
  bot.audio(async (msg, reply) => await wrapper(reply, () => {
    const chatId = msg.chat.id;
    if (memory[chatId] !== undefined) { // /telegram command was used
      if (!memory[chatId].data.audio) { // audio hasn't been sent
        reply.text(`péràí`);
        const eventEmitter = new EventEmitter();
        eventEmitter.on(`downloaded audio`, async () => {
          // to be executed after the audio download
          memory[chatId].data.audio = true;
          reply.text(`já tá. ganda meditação`);
          if (memory[chatId].data.text) await joinAudioAndText(chatId, reply);
        });
        saveAudio(bot, msg.file, audiosFolder + chatId, eventEmitter);
      } else reply.text(`já tinhas mandado áudio. manda aí texto`);
    } else reply.text(`só processo áudios para serem mandados para o Telegram, por isso tens de usar o comando /pt primeiro`);
  }));

  bot.text(async (msg, reply) => await wrapper(reply, async () => {
    let info = memory[msg.chat.id];
    if (info) {
      console.log(info.data);
      if (info.data.text)
        throw new Error(`já tinhas mandado texto, agora tens de mandar áudio`);
      const texts = textFormattingPT(msg.text);
      memory[msg.chat.id].data.text = texts.telegram;
      await joinAudioAndText(msg.chat.id, reply);
      textWithLinks(reply, texts.signal);
    } else {
      try {
        const texts = textFormattingPT(msg.text);
        textWithLinks(reply, texts.telegram);
        textWithLinks(reply, texts.signal);
      } catch (e) {
        throw new Error('Invalid text. Please use a command.');
      }
    }
  }));

  bot.command(`debug`, async (msg, reply) => await wrapper(reply, () => {
    if (msg.chat.id.toString() !== adminChatId.toString()) {
      sendMessage(adminChatId, `user @${msg.chat.username} tried to use debug \u{1F624}`);
      throw new Error(`\u{26D4} not allowed. this situation will be reported to my master. \u{26D4}`);
    }

    reply.text(`nothin's testin`);
  }));
  //#endregion

  //#region auxiliar methods

  // to make sure exceptions are handled so the bot doesn't stop on errors
  async function wrapper(reply, call) {
    try {
      await call();
    } catch (e) {
      reply.text(`Uia, isso não deu`);
      reply.text(e.message);
      console.log(e.stack);
    }
  }

  async function joinAudioAndText(chatId, reply) {
    const textToSend = memory[chatId].data.text;
    const toSendSplit = textToSend.split(`\n`);
    const badTitle = toSendSplit[2];
    const title = badTitle.substring(badTitle.indexOf(` `) + 1, badTitle.length - 1);
    const file = fs.createReadStream(audiosFolder + chatId);
    reply.sendGeneric("sendAudio",
      {audio: file, performer: toSendSplit[0], title: title, caption: textToSend, parse_mode: `Markdown`});
    await deleteUserData(chatId);
  }

  async function deleteUserData(chatId) {
    // delete audio if exists
    await del(audiosFolder + chatId);
    // delete tracked information
    delete memory[chatId];
  }

  function textWithLinks(reply, text) {
    reply.sendGeneric("sendMessage",
      {text: text, parse_mode: "Markdown", disable_web_page_preview: true});
  }

  //#endregion

}
