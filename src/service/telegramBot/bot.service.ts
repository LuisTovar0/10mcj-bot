import {Inject, Service} from "typedi";

import IBotService from "../iService/IBotService";
import {Bot} from "./types/botgram";
import config, {loadEnvVar} from "../../config";
import IBotUtilsService from "../iService/iBotUtils.service";
import IInRequestService from "../iService/iInRequest.service";
import ITextFormattingService from "../iService/iTextFormatting.service";
import IConvoMemoryService from "../iService/iConvoMemory.service";
import IListsService from "../iService/IListsService";
import IPtService from "../iService/iPt.service";
import BotError from "./botError";


const botgram = require("botgram");

@Service()
export default class BotService implements IBotService {

  constructor(
    @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
    @Inject(config.deps.service.inRequest.name) private inRequestService: IInRequestService,
    @Inject(config.deps.service.textFormatting.name) private textFormattingService: ITextFormattingService,
    @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
    @Inject(config.deps.service.lists.name) private listsService: IListsService,
    @Inject(config.deps.service.pt.name) private pt: IPtService,
  ) {
  }

  token = loadEnvVar('botToken');

  async run() {

    const bot: Bot = botgram(this.token);

    // middleware (before all the other message treatment)
    bot.all(async (msg, reply, next) => {
      if (msg.chat.type === 'channel') return; // ignore channel messages
      if (msg.group) {
        reply.text(`I don't talk in groups. Please remove me.`);
        return;
      }

      if (msg.user)
        // save requester
        await this.inRequestService.addInRequest(msg.user as { id: number, username: string/*, firstname, lastname*/ });
      else {
        reply.text(`Only available to users...`);
        return;
      }

      if (!this.botUtils.msgIsFromAdmin(msg)) {
        if (!msg.chat.username) {
          this.botUtils.markdownHideLinks(reply, `You don't look like a user... [\u{1FAD6}](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/418)`);
          return;
        }
        const username = msg.chat.username;
        if (await this.listsService.blacklist.contains(username)) {
          await reply.text(`You're blacklisted \u{1F620}`);
          return;
        }
        if (config.runningEnv === 'development') {
          await this.botUtils.sendMessage(this.botUtils.adminChatId, `@${username} tried to use the bot while in development.`);
          const isWhitelisted = await this.listsService.whitelist.contains(username);
          if (!isWhitelisted) {
            reply.text(`Our beautiful devs are developing the bot at the moment. Please don't send messages. If using it is urgent, text @tovawr`);
            return;
          }
        }
      }

      try {
        await next();
      } catch (e) {
        if (e.name !== "BotError") reply.text(`An error happened.`);
        this.botUtils.textHideLinks(reply, e.message);
        console.log(e.stack);
      }
    });

    this.pt.registerCommands(bot);
    this.listsService.registerCommands(bot);

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

    bot.command(`info_pt`, (msg, reply) => reply.text(`[Informação desatualizada]

Usa /pt para eu fazer uma formatação. Vais ter de enviar um texto \
e um áudio separadamente, por qualquer ordem, e eu respondo com tudo formatado.\n\nSempre que isto ficar confuso, usa \
/cancel; isso vai apagar todos os registos feitos sobre o teu chat, para poderes começar de novo.\n\nPara saberes \
que informações estão guardadas sobre o teu chat, /mystatus`));

    bot.command(`mystatus`, async (msg, reply) => {
      const convo = await this.convoService.wholeConvo(msg.chat.id);
      reply.text(JSON.stringify(convo || {}, null, 3));
    });

    //#endregion

    bot.command(`en`, `fr`, `es`, `de`, (msg, reply) => {
      reply.html(`<b><i>Not implemented</i></b>\n/info`);
      reply.text(`\u{1F937}\u{200D}\u{2642}\u{FE0F}`);
    });

    bot.command(`cancel`, async (msg, reply) => {
      await this.botUtils.deleteUserData(msg.chat.id);
      reply.text(`Ok irmom \u{1F5FF} registos apagados`);
    });

    bot.command(`debug`, async (msg, reply) => {
      if (config.runningEnv === `production`)
        throw new BotError(`\u{26D4} This command is not allowed in production mode \u{26D4}`);

      reply.text(`nothin's testin`);
    });

    bot.command(`report`, async (msg, reply) => {
      if (!this.botUtils.msgIsFromAdmin(msg)) {
        reply.text(`I can't report to you.`);
        return;
      }

      reply.text(this.textFormattingService.inRequestsToString(await this.inRequestService.getLastWeekRequests()));
    });

    bot.command((msg, reply) => reply.text(`Say what? I'm not recognizing that command.`));
    //#endregion

    //#region message treatment
    bot.audio(async (msg, reply) => {
      const chatId = msg.chat.id;
      const exists = await this.convoService.exists(chatId);
      if (!exists) {
        // a command has not been used
        reply.text(`só processo áudios para serem mandados para o Telegram, por isso tens de usar o comando /pt primeiro`);
        return;
      }

      const command = await this.convoService.getCommand(chatId);
      if (this.pt.isPtCommand(command)) {
        await this.pt.handleAudio(bot, msg, reply);
      } else reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
    });

    bot.text(async (msg, reply) => {
      const chatId = msg.chat.id;
      const exists = await this.convoService.exists(chatId);
      if (!exists) {
        // if a command hasn't been used, just return the formatted texts
        try {
          reply.text(`You should use a command before sending text.`);
          const texts = this.textFormattingService.getFullInfo(msg.text);
          this.botUtils.markdownHideLinks(reply, texts.telegram);
          this.botUtils.textHideLinks(reply, texts.signal);
          return;
        } catch (e) {
          if (e instanceof BotError) throw e;
          throw new BotError(`Invalid text. Please use a command.`);
        }
      }

      const command = await this.convoService.getCommand(chatId);
      if (this.pt.isPtCommand(command))
        await this.pt.handleText(msg, reply);
      else reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
    });
    //#endregion

    // inform me that it's running
    await this.botUtils.sendMessage(this.botUtils.adminChatId, 'Bot is running in ' + config.runningEnv);
  }
}