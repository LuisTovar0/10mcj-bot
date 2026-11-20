import axios from "axios";
import FormData from 'form-data';
import fs from "fs";
import { Inject, Service } from "typedi";
import config from "../../../config";
import { tempFolder } from "../../../config/constants";
import IBotUtilsService from "../../i-service/telegram-bot/i-bot-utils.service";
import IConvoMemoryService, { ConvoError } from "../../i-service/telegram-bot/i-convo-memory.service";
import IListsService from "../../i-service/telegram-bot/i-lists-service";
import IPtService from "../../i-service/telegram-bot/i-pt.service";
import BotError from "../bot-error";
import { startWorkflow, type BotMenu, type RegisterMenuAction } from "../bot-menu";
import * as textFormatting from "../text-formatting.service";
import { Bot, ReplyQueue } from "../types/botgram";
import { InputFile, Message, messageAudio, messageText } from "../types/model";

const mp3Duration: (path: string) => Promise<number> = require('mp3-duration');

@Service()
export default class PtService implements IPtService {

  private readonly channel = process.env.CHANNEL;

  constructor(
      @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
      @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
      @Inject(config.deps.service.lists.name) private listsService: IListsService,
  ) {
  }

  registerCommands(menu: BotMenu, registerMenuAction: RegisterMenuAction): void {
    registerMenuAction('pt_testar', async msg => {
      await startWorkflow(this.convoService, menu, msg.chat.id, { command: 'pt_testar', data: { audio: false } },
          'Envia o áudio e o texto da meditação em duas mensagens. Receberás a pré-visualização aqui.');
    });

    if (this.channel) {
      registerMenuAction('pt_enviar', async msg => {
        await this.listsService.ensureEditor(msg);
        await startWorkflow(this.convoService, menu, msg.chat.id, { command: 'pt_enviar', data: { audio: false } },
            `Envia o áudio e o texto da meditação em duas mensagens. Quando receber os dois, o bot publica a meditação em @${ this.channel }.`);
      });
    }
  }

  async handleAudio(bot: Bot, msg: messageAudio, reply: ReplyQueue, menu: BotMenu): Promise<void> {
    const chatId = msg.chat.id;
    const hasAudio = await this.convoService.hasAudio(chatId);
    if (hasAudio === null)
      throw await ConvoError.new(this.convoService, chatId, 'hasAudio at handleAudio');
    if (hasAudio) {
      // audio was already received
      await menu.prompt(chatId, await this.convoService.wholeConvo(chatId), 'Já recebi o áudio. Envia o texto da meditação.');
      return;
    }

    reply.text(`péràí... a baixar`);
    reply.text(`\u{1F4E5}`);
    await this.botUtils.saveFile(bot, msg.file, `${ tempFolder }/${ chatId }`);
    await this.convoService.setAudio(chatId, true);
    if (await this.convoService.getText(chatId))
      await this.finalResponse(msg, reply);
    else await menu.prompt(chatId, await this.convoService.wholeConvo(chatId), 'Áudio recebido. Agora envia o texto da meditação.');
  }

  async handleText(msg: messageText, reply: ReplyQueue, menu: BotMenu): Promise<void> {
    const chatId = msg.chat.id;
    if (await this.convoService.hasAudio(chatId)) {
      // if audio has been sent, join the audio and text, then reply with the formatted audio and Signal text
      await this.convoService.setText(chatId, textFormatting.getFullInfo(msg.text));
      await this.finalResponse(msg, reply);
    } else {
      if (await this.convoService.getText(chatId)) {
        await menu.prompt(chatId, await this.convoService.wholeConvo(chatId), 'Já recebi o texto. Envia o áudio da meditação.');
        return;
      }
      const texts = textFormatting.getFullInfo(msg.text);
      await this.convoService.setText(chatId, texts);
      await menu.prompt(chatId, await this.convoService.wholeConvo(chatId), 'Texto recebido. Agora envia o áudio da meditação.');
    }
  }

  private async finalResponse(msg: Message, reply: ReplyQueue) {
    const chatId = msg.chat.id;
    const texts = await this.convoService.getText(chatId);
    if (!texts) throw new BotError('Internal error: null values where should be text.');
    const badTitle = texts.descr1.trim();
    const title = badTitle.substring(badTitle.indexOf(` `) + 1, badTitle.length);
    const path = `${ tempFolder }/${ chatId }`;
    const duration = await mp3Duration(path).catch(() => {
      throw new BotError(`Couldn't retrieve the audio duration.`);
    });

    switch (await this.convoService.getCommand(chatId)) {
      case 'pt_testar':
        await reply.audio(fs.createReadStream(path) as unknown as InputFile,
            Math.trunc(duration), texts.date, title, texts.telegram, 'Markdown').then();
        break;
      case 'pt_enviar': {
        if (!this.channel) throw new BotError('Variável CHANNEL devia estar definida.');

        await this.listsService.ensureEditor(msg, true);
        const fd = new FormData();
        fd.append('audio', fs.createReadStream(path));
        await axios.post(`${ this.botUtils.methodsUrl }/sendAudio`, fd, {
          params: {
            chat_id: `@${ this.channel }`, caption: texts.telegram, parse_mode: 'Markdown',
            duration, title, performer: texts.date,
          },
        });
        break;
      }
    }
    this.botUtils.textHideLinks(reply, texts.signal);
    await this.botUtils.deleteUserData(chatId);
  }

  isPtCommand(command?: string): boolean {
    // return !!Object.values(config.consts.commands.pt).find(v => v === command);
    return command === 'pt_testar' || (!!this.channel && command === 'pt_enviar');
  }

}
