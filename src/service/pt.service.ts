import {Inject, Service} from "typedi";
import fs from "fs";
import FormData from 'form-data';

import IPtService from "./iService/iPt.service";
import {Bot, ReplyQueue} from "../bot/types/botgram";
import {messageAudio, messageText} from "../bot/types/model";
import BotError from "../bot/botError";
import IConvoMemoryService from "./iService/iConvoMemory.service";
import {audiosFolder, deleteUserData, textWithLinks} from "../bot/general";
import ITextFormattingService from "./iService/iTextFormatting.service";
import {saveFile} from "../bot/audio";
import config from "../config";
import axios from "axios";

@Service()
export default class PtService implements IPtService {

  private readonly channel = process.env.CHANNEL;

  constructor(
    @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
    @Inject(config.deps.service.textFormatting.name) private textFormattingService: ITextFormattingService,
  ) {
  }

  registarComandos(bot: Bot): void {

    bot.command(`pt`, async (msg, reply) => {
      reply.text(`Comandos disponíveis:
/pt_testar mostra o funcionamento normal do bot, mas sem enviar mensagens${this.channel ? `
/pt_enviar pede algumas informações e envia a mensagen para o canal de Telegram` : ''}`);
    });

    // para comandos de edição de áudios e textos
    const registarComando = (bot: Bot, comando: string) => {
      bot.command(comando, async (msg, reply) => {
        const exists = await this.convoService.exists(msg.chat.id);
        if (!exists) {
          await this.convoService.set(msg.chat.id, {
            command: comando, data: {
              audio: false
            }
          });
          reply.text(`okapa. que venham o áudio e o texto`);
        } else reply.text(`Já tinhas declarado o comando. Agora tem de ser um áudio e um texto, separados. Se não quiseres podes usar /cancel`);
      });
    };

    registarComando(bot, `pt_testar`);

    if (this.channel)
      registarComando(bot, `pt_enviar`);

  }

  async handleAudio(bot: Bot, msg: messageAudio, reply: ReplyQueue): Promise<void> {
    const chatId = msg.chat.id;
    if (await this.convoService.hasAudio(chatId)) {
      // audio was already received
      reply.text(`já tinhas mandado áudio. manda aí texto`);
      return;
    }

    reply.text(`péràí... a baixar`);
    reply.text(`\u{1F4E5}`);
    await saveFile(bot, msg, audiosFolder + chatId);
    await this.convoService.setAudio(chatId, true);
    if (await this.convoService.getText(chatId))
      await this.finalResponse(chatId, reply);
    else reply.text(`já tá! ganda meditação`);
  }

  async handleText(msg: messageText, reply: ReplyQueue): Promise<void> {
    const chatId = msg.chat.id;
    if (await this.convoService.hasAudio(chatId)) {
      // if audio has been sent, join the audio and text, then reply with the formatted audio and Signal text
      await this.convoService.setText(chatId, this.textFormattingService.getFullInfo(msg.text));
      await this.finalResponse(chatId, reply);
    } else {
      // if we don't have audio but already have text, let the user know
      if (await this.convoService.getText(chatId))
        throw new BotError(`já tinhas mandado texto, agora tens de mandar áudio.\nou então /cancel`);
      const texts = this.textFormattingService.getFullInfo(msg.text);
      await this.convoService.setText(chatId, texts);
      reply.text(`boa escolha de emojis ${texts.descr1.split(` `)[0]}`);
    }
  }

  async finalResponse(chatId: number, reply: ReplyQueue) {
    const texts = await this.convoService.getText(chatId);
    if (!texts) throw new BotError('Internal error: null values where should be text.');
    const badTitle = texts.descr1.trim();
    const title = badTitle.substring(badTitle.indexOf(` `) + 1, badTitle.length);
    const mp3duration = require('mp3-duration');
    mp3duration(audiosFolder + chatId, async (err: any, duration: string) => {
      if (err) throw new BotError(`Couldn't retrieve the audio duration.`);
      const file = fs.createReadStream(audiosFolder + chatId);
      switch (await this.convoService.getCommand(chatId)) {
        case `pt_testar`:
          reply.audio(file, parseInt(duration), texts.date, title, texts.telegram, `Markdown`);
          textWithLinks(reply, texts.signal);
          break;
        case `pt_enviar`:
          if (!this.channel) throw new BotError('Variável CHANNEL devia estar definida.');

          // send to Telegram
          const fd = new FormData();
          fd.append('audio', file);
          await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendAudio`,
            fd, {
              params: {
                chat_id: `@${this.channel}`, caption: texts.telegram, parse_mode: 'Markdown',
                duration, title, performer: texts.date
              }
            });
          reply.text(`Sent to @${this.channel}`);

          // send to Signal
          textWithLinks(reply, texts.signal);
          reply.text('Not yet able to send to Signal');//todo
          break;
      }
      await deleteUserData(chatId);
    });
  }

  isPtCommand(command?: string): boolean {
    // return !!Object.values(config.consts.commands.pt).find(v => v === command);
    return command === 'pt_testar' || (!!this.channel && command === 'pt_enviar');
  }

}