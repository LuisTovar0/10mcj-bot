import {Inject, Service} from "typedi";
import fs from "fs";
import FormData from 'form-data';
import axios from "axios";

import IPtService from "../../iService/telegramBot/iPt.service";
import BotError from "../botError";
import IConvoMemoryService from "../../iService/telegramBot/iConvoMemory.service";
import ITextFormattingService from "../../iService/telegramBot/iTextFormatting.service";
import config from "../../../config";
import {tempFolder} from "../../../config/constants";
import IBotUtilsService from "../../iService/telegramBot/iBotUtils.service";
import IImageService from "../../iService/iImage.service";
import {Context, Telegraf} from "telegraf";
import {InputFile} from "telegraf/types";

@Service()
export default class PtService implements IPtService {

  private readonly channel = process.env.CHANNEL;

  constructor(
    @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
    @Inject(config.deps.service.textFormatting.name) private textFormattingService: ITextFormattingService,
    @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
    @Inject(config.deps.service.image.name) private imageService: IImageService,
  ) {
  }

  registerCommands(bot: Telegraf): void {

    bot.command(`pt`, async ctx => {
      ctx.reply(`Comandos disponíveis:
/pt_testar mostra o funcionamento normal do bot, mas sem enviar mensagens${this.channel ? `
/pt_enviar pede algumas informações e envia a mensagen para o canal de Telegram` : ''}
/pt_img`);
    });

    // para comandos de edição de áudios e textos
    const registarComando = (bot: Telegraf, comando: string) => {
      bot.command(comando, async ctx => {
        const exists = await this.convoService.exists(ctx.chat.id);
        if (exists) {
          ctx.reply(`Já tinhas declarado o comando. Agora tem de ser um áudio e um texto, separados. Se não quiseres podes usar /cancel`);
          return;
        }
        await this.convoService.set(ctx.chat.id, {
          command: comando, data: {
            audio: false
          }
        });
        ctx.reply(`okapa. que venham o áudio e o texto`);
      });
    };

    registarComando(bot, `pt_testar`);

    if (this.channel)
      registarComando(bot, `pt_enviar`);

  }

  // async handleAudio(bot: Telegraf, ctx: Context): Promise<void> {
  //   if (!ctx || !ctx.chat) throw new Error();
  //   const chatId = ctx.chat.id;
  //   const hasAudio = await this.convoService.hasAudio(chatId);
  //   if (hasAudio === null)
  //     throw await ConvoError.new(this.convoService, chatId, 'hasAudio at handleAudio');
  //   if (hasAudio) {
  //     // audio was already received
  //     await ctx.reply(`já tinhas mandado áudio. manda aí texto`);
  //     return;
  //   }
  //
  //   await ctx.reply(`péràí... a baixar`);
  //   await ctx.reply(`\u{1F4E5}`);
  //
  //   // ctx.message.audio
  //   // await this.botUtils.saveFile(bot, , `${tempFolder}/${chatId}`); // todo
  //
  //   await this.convoService.setAudio(chatId, true);
  //   if (await this.convoService.getText(chatId))
  //     await this.finally(ctx);
  //   else await ctx.reply(`já tá! ganda meditação`);
  // }
  //
  // async handleText(ctx:Context): Promise<void> {
  //   if (!ctx || !ctx.chat) throw new Error();
  //   const chatId = ctx.chat.id;
  //   if (await this.convoService.hasAudio(chatId)) {
  //     // if audio has been sent, join the audio and text, then reply with the formatted audio and Signal text
  //     await this.convoService.setText(chatId, this.textFormattingService.getFullInfo(text));
  //     await this.finally(ctx);
  //   } else {
  //     if (await this.convoService.getText(chatId))
  //       // if we don't have audio but already have text, let the user know
  //       throw new BotError(`já tinhas mandado texto, agora tens de mandar áudio.\nou então /cancel`);
  //     const texts = this.textFormattingService.getFullInfo(text);
  //     await this.convoService.setText(chatId, texts);
  //     await ctx.reply(`boa escolha de emojis ${texts.descr1.split(` `)[0]}`);
  //   }
  // }

  async finally(ctx: Context) {
    if (!ctx || !ctx.chat) throw new Error();
    const chatId = ctx.chat.id;
    const texts = await this.convoService.getText(chatId);
    if (!texts) throw new BotError('Internal error: null values where should be text.');
    const badTitle = texts.descr1.trim();
    const title = badTitle.substring(badTitle.indexOf(` `) + 1, badTitle.length);
    const mp3duration = require('mp3-duration');
    mp3duration(`${tempFolder}/${chatId}`, async (err: any, duration: string) => {
      if (err) throw new BotError(`Couldn't retrieve the audio duration.`);
      const file = fs.createReadStream(`${tempFolder}/${chatId}`);
      switch (await this.convoService.getCommand(chatId)) {
        case `pt_testar`:
          await ctx.replyWithAudio(file as unknown as InputFile, {
            duration: parseInt(duration), performer: texts.date, title,
            caption: texts.telegram, parse_mode: `Markdown`
          });
          break;
        case `pt_enviar`:
          if (!this.channel) throw new BotError('Variável CHANNEL devia estar definida.');

          const fd = new FormData();
          fd.append('audio', file);
          await axios.post(`${this.botUtils.methodsUrl}/sendAudio`,
            fd, {
              params: {
                chat_id: `@${this.channel}`, caption: texts.telegram, parse_mode: 'Markdown',
                duration, title, performer: texts.date
              }
            });
          break;
      }
      await ctx.reply(texts.signal);
      await this.botUtils.deleteUserData(chatId);
    });
  }

  isPtCommand(command?: string): boolean {
    // return !!Object.values(config.consts.commands.pt).find(v => v === command);
    return command === 'pt_testar' || (!!this.channel && command === 'pt_enviar');
  }

}
