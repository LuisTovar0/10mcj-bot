import {Inject, Service} from "typedi";
import fs from "fs";
import FormData from 'form-data';
import moment from "moment";
import axios from "axios";

import IPtService from "../iService/iPt.service";
import {Bot, ReplyQueue} from "../../bot/types/botgram";
import {InputFile, messageAudio, messageText} from "../../bot/types/model";
import BotError from "../../bot/botError";
import IConvoMemoryService from "../iService/iConvoMemory.service";
import {audiosFolder, deleteUserData, filesFolder, textWithLinks} from "../../bot/general";
import ITextFormattingService from "../iService/iTextFormatting.service";
import {saveFile} from "../../bot/audio";
import config from "../../config";
import IImageEditingService from "../iService/iImageEditing.service";
import {telegramBotUrl} from "../../config/constants";

@Service()
export default class PtService implements IPtService {

  private readonly channel = process.env.CHANNEL;

  constructor(
    @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
    @Inject(config.deps.service.textFormatting.name) private textFormattingService: ITextFormattingService,
    @Inject(config.deps.service.imageEditing.name) private imageEditingService: IImageEditingService,
  ) {
  }

  registerCommands(bot: Bot): void {

    bot.command(`pt`, async (msg, reply) => {
      reply.text(`Comandos disponíveis:
/pt_testar mostra o funcionamento normal do bot, mas sem enviar mensagens${this.channel ? `
/pt_enviar pede algumas informações e envia a mensagen para o canal de Telegram` : ''}
/pt_img`);
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

    bot.command(`pt_img`, async (msg, reply) => {
      const title = msg.text.split(' ').slice(1).join(' ');
      const {day, month, year} = this.textFormattingService.theDate();
      moment.locale('pt-pt');
      const date = moment().date(day).month(month).year(year).format("DD MMMM YYYY").toString();
      const photo = fs.readFileSync(`${filesFolder}/rapaz.jpg`);
      const generatedFile = await this.imageEditingService.generate(photo, date, title);
      const generatedFileName = `./${moment().valueOf()}.png`;
      fs.writeFileSync(generatedFileName, generatedFile);
      const fd = new FormData();
      fd.append('photo', fs.createReadStream(generatedFileName));
      await axios.post(`${telegramBotUrl}/sendPhoto`,
        fd, {params: {chat_id: msg.chat.id}});
      fs.unlinkSync(generatedFileName);
    });

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
    await saveFile(bot, msg, `${audiosFolder}/${chatId}`);
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
    mp3duration(`${audiosFolder}/${chatId}`, async (err: any, duration: string) => {
      if (err) throw new BotError(`Couldn't retrieve the audio duration.`);
      const file = fs.createReadStream(`${audiosFolder}/${chatId}`);
      switch (await this.convoService.getCommand(chatId)) {
        case `pt_testar`:
          reply.audio(file as unknown as InputFile, parseInt(duration), texts.date, title, texts.telegram, `Markdown`);
          break;
        case `pt_enviar`:
          if (!this.channel) throw new BotError('Variável CHANNEL devia estar definida.');

          const fd = new FormData();
          fd.append('audio', file);
          await axios.post(`${telegramBotUrl}/sendAudio`,
            fd, {
              params: {
                chat_id: `@${this.channel}`, caption: texts.telegram, parse_mode: 'Markdown',
                duration, title, performer: texts.date
              }
            });
          break;
      }
      textWithLinks(reply, texts.signal);
      await deleteUserData(chatId);
    });
  }

  isPtCommand(command?: string): boolean {
    // return !!Object.values(config.consts.commands.pt).find(v => v === command);
    return command === 'pt_testar' || (!!this.channel && command === 'pt_enviar');
  }

}
