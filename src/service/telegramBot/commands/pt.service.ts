import axios from "axios";
import FormData from 'form-data';
import fs from "fs";
import {Inject, Service} from "typedi";
import config from "../../../config";
import {tempFolder} from "../../../config/constants";
import IBotUtilsService from "../../iService/telegramBot/i-bot-utils.service";
import IConvoMemoryService, {ConvoError} from "../../iService/telegramBot/i-convo-memory.service";
import IListsService from "../../iService/telegramBot/i-lists-service";
import IPtService from "../../iService/telegramBot/i-pt.service";
import BotError from "../botError";
import * as textFormatting from "../text-formatting.service";
import {Bot, ReplyQueue} from "../types/botgram";
import {InputFile, messageAudio, messageCommand, messageText} from "../types/model";

@Service()
export default class PtService implements IPtService {

  private readonly channel = process.env.CHANNEL;

  constructor(
      @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
      @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
      @Inject(config.deps.service.lists.name) private listsService: IListsService,
  ) {
  }

  registerCommands(bot: Bot): void {

    bot.command(`pt`, async (msg, reply) => {
      reply.markdown(`Comandos disponíveis:
/pt\\_testar - Mostra o funcionamento normal do bot, mas sem enviar mensagens${this.channel ? `
/pt\\_enviar - Pede algumas informações e envia a mensagen para o canal de Telegram` : ''}
/pt\\_img - Gera uma capa para um vídeo do YouTube. Utilização: \`/pt_img texto\`, onde "texto" é o texto que será colocado na imagem.`);
    });

    // para comandos de edição de áudios e textos
    const sending = async (msg: messageCommand, reply: ReplyQueue) => {
      const exists = await this.convoService.exists(msg.chat.id);
      if (!exists) {
        await this.convoService.set(msg.chat.id, {
          command: msg.command, data: {
            audio: false,
          },
        });
        reply.text(`okapa. que venham o áudio e o texto`);
      } else reply.text(`Já tinhas declarado o comando. Agora tem de ser um áudio e um texto, separados. Se não quiseres podes usar /cancel`);
    };

    bot.command('pt_testar', sending);

    if (this.channel)
      bot.command('pt_enviar', async (msg, reply) => {
        if (msg.user?.username && await this.listsService.whitelist.contains(msg.user?.username)) {
          await sending(msg, reply);
          return;
        }
        reply.text('\u{1F6AB} Not allowed. \u{1F6AB}');
      });

  }

  async handleAudio(bot: Bot, msg: messageAudio, reply: ReplyQueue): Promise<void> {
    const chatId = msg.chat.id;
    const hasAudio = await this.convoService.hasAudio(chatId);
    if (hasAudio === null)
      throw await ConvoError.new(this.convoService, chatId, 'hasAudio at handleAudio');
    if (hasAudio) {
      // audio was already received
      reply.text(`já tinhas mandado áudio. manda aí texto`);
      return;
    }

    reply.text(`péràí... a baixar`);
    reply.text(`\u{1F4E5}`);
    await this.botUtils.saveFile(bot, msg.file, `${tempFolder}/${chatId}`);
    await this.convoService.setAudio(chatId, true);
    if (await this.convoService.getText(chatId))
      await this.finalResponse(chatId, reply);
    else reply.text(`já tá! ganda meditação`);
  }

  async handleText(msg: messageText, reply: ReplyQueue): Promise<void> {
    const chatId = msg.chat.id;
    if (await this.convoService.hasAudio(chatId)) {
      // if audio has been sent, join the audio and text, then reply with the formatted audio and Signal text
      await this.convoService.setText(chatId, textFormatting.getFullInfo(msg.text));
      await this.finalResponse(chatId, reply);
    } else {
      if (await this.convoService.getText(chatId))
          // if we don't have audio but already have text, let the user know
        throw new BotError(`já tinhas mandado texto, agora tens de mandar áudio.\nou então /cancel`);
      const texts = textFormatting.getFullInfo(msg.text);
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
    mp3duration(`${tempFolder}/${chatId}`, async (err: any, duration: string) => {
      if (err) throw new BotError(`Couldn't retrieve the audio duration.`);
      const file = fs.createReadStream(`${tempFolder}/${chatId}`);
      switch (await this.convoService.getCommand(chatId)) {
        case `pt_testar`:
          reply.audio(file as unknown as InputFile, parseInt(duration), texts.date, title, texts.telegram, `Markdown`);
          break;
        case `pt_enviar`:
          if (!this.channel) throw new BotError('Variável CHANNEL devia estar definida.');

          const fd = new FormData();
          fd.append('audio', file);
          await axios.post(`${this.botUtils.methodsUrl}/sendAudio`,
              fd, {
                params: {
                  chat_id: `@${this.channel}`, caption: texts.telegram, parse_mode: 'Markdown',
                  duration, title, performer: texts.date,
                },
              });
          break;
      }
      this.botUtils.textHideLinks(reply, texts.signal);
      await this.botUtils.deleteUserData(chatId);
    });
  }

  isPtCommand(command?: string): boolean {
    // return !!Object.values(config.consts.commands.pt).find(v => v === command);
    return command === 'pt_testar' || (!!this.channel && command === 'pt_enviar');
  }

}
