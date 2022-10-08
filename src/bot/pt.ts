import {Container} from "typedi";
import fs from "fs";

import {Bot, ReplyQueue} from "./types/botgram";
import IConvoMemoryService from "../service/iService/iConvoMemory.service";
import config from "../config";
import {saveFile} from "./audio";
import {audiosFolder, deleteUserData, textWithLinks} from "./general";
import BotError from "./botError";
import {messageAudio, messageText} from "./types/model";
import ITextFormattingService from "../service/iService/iTextFormatting.service";

const mp3Duration = require('mp3-duration');
const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;
const textFormattingService = Container.get(config.deps.service.textFormatting.name) as ITextFormattingService;

const registarComando = (bot: Bot, comando: string) => {
  bot.command(comando, async (msg, reply) => {
    const exists = await convoService.exists(msg.chat.id);
    if (!exists) {
      await convoService.set(msg.chat.id, {
        command: comando, data: {
          audio: false
        }
      });
      reply.text(`okapa. que venham o áudio e o texto`);
    } else reply.text(`Já tinhas declarado o comando. Agora tem de ser um áudio e um texto, separados. Se não quiseres podes usar /cancel`);
  });
};

export function registarComandos(bot: Bot) {

  bot.command(`pt`, async (msg, reply) => {
    reply.text(`Comandos disponíveis:
/pt-testar mostra o funcionamento normal do bot, mas sem enviar mensagens
/pt-enviar pede algumas informações e envia a mensagen para o canal de Telegram`);
  });

  registarComando(bot, `pt-testar`);

  registarComando(bot, `pt-enviar`);

}

export async function handleAudio(bot: Bot, msg: messageAudio, reply: ReplyQueue) {
  const chatId = msg.chat.id;
  if (await convoService.hasAudio(chatId)) {
    // audio was already received
    reply.text(`já tinhas mandado áudio. manda aí texto`);
    return;
  }

  reply.text(`péràí... a baixar`);
  reply.text(`\u{1F4E5}`);
  await saveFile(bot, msg, audiosFolder + chatId);
  await convoService.setAudio(chatId, true);
  if (await convoService.getText(chatId))
    await finalResponse(chatId, reply);
  else reply.text(`já tá! ganda meditação`);
}

export async function handleText(msg: messageText, reply: ReplyQueue) {
  const chatId = msg.chat.id;
  if (await convoService.hasAudio(chatId)) {
    // if audio has been sent, join the audio and text, then reply with the formatted audio and Signal text
    await convoService.setText(chatId, textFormattingService.getFullInfo(msg.text));
    await finalResponse(chatId, reply);
  } else {
    // if we don't have audio but already have text, let the user know
    if (await convoService.getText(chatId))
      throw new BotError(`já tinhas mandado texto, agora tens de mandar áudio.\nou então /cancel`);
    const texts = textFormattingService.getFullInfo(msg.text);
    await convoService.setText(chatId, texts);
    reply.text(`boa escolha de emojis ${texts.descr1.split(` `)[0]}`);
  }
}

/**
 * Generate the final responses. This function is called when both the audio and the text have been sent to the bot. It:
 * <ul><li>Checks the duration of the audio</li><li>Depending on the present command, sends the Telegram audio+message
 * to the channel or to the use</li><li>Sends the Signal text to the user</li></ul>
 */
async function finalResponse(chatId: number, reply: ReplyQueue) {
  const texts = await convoService.getText(chatId);
  if (!texts) throw new BotError('Internal error: null values where should be text.');
  const badTitle = texts.descr1.trim();
  const title = badTitle.substring(badTitle.indexOf(` `) + 1, badTitle.length);
  mp3Duration(audiosFolder + chatId, async (err: any, duration: string) => {
    if (err) throw new BotError(`Couldn't retrieve the audio duration.`);
    const file = fs.createReadStream(audiosFolder + chatId);
    switch (await convoService.getCommand(chatId)) {
      case `pt-testar`:
        reply.audio(file, parseInt(duration), texts.date, title, texts.telegram, `Markdown`);
        break;
      case `pt-enviar`:
        //todo
        reply.audio(file, parseInt(duration), texts.date, title, texts.telegram, `Markdown`);
        break;
    }
    textWithLinks(reply, texts.signal);
    await deleteUserData(chatId);
  });
}
