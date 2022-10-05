import fs from "fs";
import del from "del";
import {Container} from "typedi";

import config from "../config";
import {saveFile} from "./audio";
import BotError from "./botError";
import {audiosFolder, markdownWithLinks, sendMessage, textWithLinks} from "./general";
import {Bot, ReplyQueue} from "./types/botgram";
import IInRequestService from "../service/iService/iInRequest.service";
import ITextFormattingService from "../service/iService/iTextFormatting.service";
import IConvoMemoryService from "../service/iService/iConvoMemory.service";

const botgram = require("botgram");
const mp3Duration = require('mp3-duration');

export default () => {

  const bot: Bot = botgram(config.botToken);

  const inRequestService = Container.get(config.deps.service.inRequest.name) as IInRequestService;
  const textFormattingService = Container.get(config.deps.service.textFormatting.name) as ITextFormattingService;
  const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;

  bot.all(async (msg, reply, next) => {
    if (config.runningEnv === 'development' && msg.chat.id.toString() !== config.adminChatId.toString()) {
      sendMessage(config.adminChatId, `@${msg.chat.username} tried to use the bot while in development.`);
      sendMessage(String(msg.chat.id), `Our beautiful devs are developing the bot at the moment. Please don't send messages.`);
    } else {
      try {
        if (msg.user)
          // save requester
          await inRequestService.addInRequest(msg.user as { id: number, username: string/*, firstname, lastname*/ });

        await next();
      } catch (e) {
        if (e.name !== "BotError") reply.text(`An error happened.`);
        textWithLinks(reply, e.message);
        console.log(e.stack);
      }
    }
  });

  //#region commands

  //#region info commands
  bot.command(`start`, (msg, reply) => reply.text(`
\u{1F1F5}\u{1F1F9} Bem-vindo, co-administrador dos @dezmincomjesus!
\u{1F1EC}\u{1F1E7}\u{1F1FA}\u{1F1F8} Welcome, fellow @tenminuteswithjesus admin!
\u{1F1EA}\u{1F1F8} Bienvenido, compañero administrador de @diezminutos!
\u{1F1EB}\u{1F1F7} Bienvenue, ami administrateur de @dixminutesavecjesus!
\u{1F1E9}\u{1F1EA} Willkommen, kollege des @zehnmmj!

Contact @tovawr for an implementation in your language!
Currently available languages: /pt

Anytime you do something you didn't mean to, use the /cancel command`));

  bot.command(`info`, (msg, reply) => reply.text(`/info_pt instruções\n
Contact @tovawr for an implementation in your language!
Anyway, hit /start for an international welcome message \u{1F30F}\n
<b>Privacy notice</b>: The number of messages you send to the bot is saved since this is meant to be a \
more or less private bot.`, "HTML"));

  bot.command(`info_pt`, (msg, reply) => reply.text(`Usa /pt para eu fazer uma formatação. Vais ter de enviar um texto \
e um áudio separadamente, por qualquer ordem, e eu respondo com tudo formatado.\n\nSempre que isto ficar confuso, usa \
/cancel; isso vai apagar todos os registos feitos sobre o teu chat, para poderes começar de novo.\n\nPara saberes \
que informações estão guardadas sobre o teu chat, /mystatus`));

  bot.command(`mystatus`, async (msg, reply) => {
    const convo = await convoService.wholeConvo(msg.chat.id);
    reply.text(JSON.stringify(convo || {}, null, 3));
  });
  //#endregion

  bot.command(`pt`, async (msg, reply) => {
    const exists = await convoService.exists(msg.chat.id);
    if (!exists) {
      await convoService.set(msg.chat.id, {
        command: `pt`, data: {
          audio: false
        }
      });
      reply.text(`okapa. que venham o áudio e o texto`);
    } else reply.text(`Já tinhas declarado o comando. Agora tem de ser um áudio e um texto, separados. Se não quiseres podes usar /cancel`);
  });

  bot.command(`en`, `fr`, `es`, `de`, (msg, reply) => {
    reply.html(`<b><i>Not yet implemented</i></b>\n/info`);
    reply.text(`\u{1F937}\u{200D}\u{2642}\u{FE0F}`);
  });

  bot.command(`cancel`, async (msg, reply) => {
    await deleteUserData(msg.chat.id);
    reply.text(`Ok irmom \u{1F5FF} registos apagados`);
  });

  bot.command(`debug`, async (msg, reply) => {
    if (config.runningEnv === `production`)
      throw new BotError(`\u{26D4} This command is not allowed in production mode \u{26D4}`);

    reply.text(`nothin's testin`);
  });

  bot.command(`report`, async (msg, reply) => {
    if (String(msg.chat.id) !== config.adminChatId)
      reply.text(`I can't report to you.`);

    reply.text(textFormattingService.inRequestsToString(await inRequestService.getLastWeekRequests()));
  });
  //#endregion

  //#region message treatment
  bot.audio(async (msg, reply) => {
    const chatId = msg.chat.id;
    const exists = await convoService.exists(chatId);
    if (!exists) {
      // a command has not been used
      reply.text(`só processo áudios para serem mandados para o Telegram, por isso tens de usar o comando /pt primeiro`);
      return;
    }

    switch (await convoService.getCommand(chatId)) {
      case `pt`:
        if (await convoService.hasAudio(chatId)) {
          // audio was already received
          reply.text(`já tinhas mandado áudio. manda aí texto`);
          return;
        }

        reply.text(`péràí... a baixar`);
        reply.text(`\u{1F4E5}`);
        await saveFile(bot, msg, audiosFolder + chatId);
        await convoService.setAudio(chatId, true);
        if (await convoService.getText(chatId)) await joinAudioAndText(chatId, reply);
        else reply.text(`já tá! ganda meditação`);
        break;
      default:
        reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
    }
  });

  bot.text(async (msg, reply) => {
    const chatId = msg.chat.id;
    const exists = await convoService.exists(chatId);
    if (!exists) {
      // if a command hasn't been used, just return the formatted texts
      try {
        reply.text(`You should use a command before sending text.`);
        const texts = textFormattingService.getFullInfo(msg.text);
        markdownWithLinks(reply, texts.telegram);
        textWithLinks(reply, texts.signal);
        return;
      } catch (e) {
        if (e instanceof BotError) throw e;
        throw new BotError(`Invalid text. Please use a command.`);
      }
    }

    switch (await convoService.getCommand(chatId)) {
      case `pt`:
        if (await convoService.hasAudio(chatId)) {
          // if audio has been sent, join the audio and text, then reply with the formatted audio and Signal text
          await convoService.setText(chatId, textFormattingService.getFullInfo(msg.text));
          await joinAudioAndText(chatId, reply);
        } else {
          // if we don't have audio but already have text, let the user know
          if (await convoService.getText(chatId))
            throw new BotError(`já tinhas mandado texto, agora tens de mandar áudio.\nou então /cancel`);
          const texts = textFormattingService.getFullInfo(msg.text);
          await convoService.setText(chatId, texts);
          reply.text(`boa escolha de emojis ${texts.descr1.split(` `)[0]}`);
        }
        break;
      default:
        reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
    }
  });
  //#endregion

  //#region auxiliary methods
  async function joinAudioAndText(chatId: number, reply: ReplyQueue) {
    const texts = await convoService.getText(chatId);
    if (!texts || !texts.descr1) throw new BotError('Internal error: null values where should be text.');
    const badTitle = texts.descr1.trim();
    const title = badTitle.substring(badTitle.indexOf(` `) + 1, badTitle.length);
    mp3Duration(audiosFolder + chatId, async (err: any, duration: string) => {
      if (err) throw new BotError(`Couldn't retrieve the audio duration.`);
      if (!texts.signal || !texts.date || !texts.telegram) throw new BotError('Internal error: null values where should be text.');
      const file = fs.createReadStream(audiosFolder + chatId);
      reply.audio(file, parseInt(duration), texts.date, title, texts.telegram, `Markdown`);
      textWithLinks(reply, texts.signal);
      await deleteUserData(chatId);
    });
  }

  async function deleteUserData(chatId: number) {
    // delete audio if exists
    await del(audiosFolder + String(chatId));
    // delete tracked information
    await convoService.delete(chatId);
  }

  //#endregion

}
