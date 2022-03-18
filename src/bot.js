import fs from "fs";
import {EventEmitter} from "events";
import del from "del";
import botgram from "botgram";

import {saveAudio} from "./audio.js";
import {audiosFolder, hasEntries, sendMessage} from "./shared.js";
import {textFormattingPT} from "./textFormatting.js";

export default (botToken, adminChatId) => {

  const memory = {};
  const bot = botgram(botToken);

  //#region commands

  //#region info commands
  bot.command(`start`, (msg, reply) => reply.text(`
Bem-vindo, co-administrador dos @dezmincomjesus!
Welcome, fellow @tenminuteswithjesus admin!
Bienvenido, compañero administrador de @diezminutos!
Bienvenue, ami administrateur de @dixminutesavecjesus!
Willkommen, kollege des @zehnmmj!

Contact @tovawr for an implementation in your language!
Currently available languages: /pt

Anytime you do something you didn't mean to, use the /cancel command!`));

  bot.command(`info`, (msg, reply) => reply.text(`/info_pt instruções\n\nContact @tovawr for an implementation in your language!`));

  bot.command(`info_pt`, (msg, reply) => reply.text(`Usa /pt para eu fazer uma formatação. Vais ter de enviar um texto \
e um áudio separadamente, por qualquer ordem, e eu respondo com tudo formatado.\n\nSempre que isto ficar confuso, usa \
/cancel; isso vai apagar todos os registos feitos sobre o teu chat, para poderes começar de novo.\n\nPara saberes \
que informações estão guardadas sobre o teu chat, /mystatus`));

  bot.command(`mystatus`, (msg, reply) => reply.text(JSON.stringify(memory[msg.chat.id] || {}, null, 3)));
  //#endregion

  bot.command(`pt`, async (msg, reply) => await wrapper(reply, () => {
    if (!memory[msg.chat.id]) {
      memory[msg.chat.id] = {
        command: `pt`, data: {
          audio: false, text: {}
        }
      };
      reply.text(`okapa. que venham o áudio e o texto`);
    } else reply.text(`Já tinhas declarado o comando. Agora tem de ser um áudio e um texto, separados. Se não quiseres podes usar /cancel`);
  }));

  bot.command(`en`, `fr`, `es`, `de`, (mag, reply) => {
    reply.html(`<b><i>Not yet implemented</i></b>\n/info`);
    reply.text(`\u{1F937}\u{200D}\u{2642}\u{FE0F}`);
  });

  bot.command(`cancel`, (msg, reply) => wrapper(reply, async () => {
    await deleteUserData(msg.chat.id);
    reply.text(`Ok irmom \u{1F5FF} registos apagados`);
  }));
  //#endregion

  //#region message treatment
  bot.audio(async (msg, reply) => await wrapper(reply, async () => {
    const chatId = msg.chat.id;
    if (!memory[chatId]) {
      // a command has not been used
      reply.text(`só processo áudios para serem mandados para o Telegram, por isso tens de usar o comando /pt primeiro`);
      return;
    }

    switch (memory[chatId].command) {
      case `pt`:
        if (memory[chatId].data.audio) {
          // audio was already received
          reply.text(`já tinhas mandado áudio. manda aí texto`);
          return;
        }

        reply.text(`péràí...`);
        reply.text(`\u{1F4E5}`);
        const eventEmitter = new EventEmitter();
        eventEmitter.on(`downloaded audio`, async () => {
          // to be executed after the audio download
          memory[chatId].data.audio = true;
          if (hasEntries(memory[chatId].data.text)) await joinAudioAndText(chatId, reply);
          else reply.text(`já tá. ganda meditação`);
        });
        saveAudio(bot, msg.file, audiosFolder + chatId, eventEmitter);
        break;
      default:
        reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
    }
  }));

  bot.text(async (msg, reply) => await wrapper(reply, async () => {
    const chatId = msg.chat.id;
    if (!memory[chatId]) {
      // if a command hasn't been used, just return the formatted texts
      try {
        reply.text(`You should use a command before sending text.`);
        const texts = textFormattingPT(msg.text);
        textWithLinks(reply, texts.telegram);
        textWithLinks(reply, texts.signal);
        return;
      } catch (e) {
        throw new Error(`Invalid text. Please use a command.`);
      }
    }

    switch (memory[chatId].command) {
      case `pt`:
        console.log(memory[chatId].data);
        if (memory[chatId].data.audio) {
          // if audio has been sent, join the audio and text, then reply with the formatted audio and Signal text
          memory[chatId].data.text = textFormattingPT(msg.text);
          await joinAudioAndText(chatId, reply);
        } else {
          // if we don't have audio but already have text, let the user know
          if (hasEntries(memory[chatId].data.text))
            throw new Error(`já tinhas mandado texto, agora tens de mandar áudio\nou então /cancel`);
          const texts = textFormattingPT(msg.text);
          memory[chatId].data.text = texts;
          reply.text(`boa escolha de emojis ${texts.descr.split(` `)[0]}`);
        }
        break;
      default:
        reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
    }
  }));

  bot.command(`debug`, async (msg, reply) => await wrapper(reply, () => {
    if (msg.chat.id.toString() !== adminChatId.toString()) {
      sendMessage(adminChatId, `user @${msg.chat.username} tried to use debug \u{1F624}`);
      throw new Error(`\u{26D4} not allowed. this situation will be reported to my master. \u{26D4}`);
    }

    // reply.text(`nothin's testin`);
    if (Object.entries({}).length) reply.text(true);
    else reply.text(false);
  }));
  //#endregion

  //#region auxiliar methods

  // to make sure exceptions are handled so the bot doesn't stop on errors
  async function wrapper(reply, call) {
    try {
      await call();
    } catch (e) {
      reply.text(`An error happened.`);
      reply.text(e.message);
      console.log(e.stack);
    }
  }

  async function joinAudioAndText(chatId, reply) {
    const badTitle = memory[chatId].data.text.descr;
    const title = badTitle.substring(badTitle.indexOf(` `) + 1, badTitle.length - 1);
    const file = fs.createReadStream(audiosFolder + chatId);
    reply.sendGeneric("sendAudio",
      {
        audio: file, performer: memory[chatId].data.text.date, title: title,
        caption: memory[chatId].data.text.telegram, parse_mode: `Markdown`
      });
    textWithLinks(reply, memory[chatId].data.text.signal);
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
