import {Inject, Service} from "typedi";
import {Telegraf} from "telegraf";

import IBotService from "../iService/telegramBot/IBotService";
import config, {loadEnvVar} from "../../config";
import IBotUtilsService from "../iService/telegramBot/iBotUtils.service";
import IInRequestService from "../iService/iInRequest.service";
import ITextFormattingService from "../iService/telegramBot/iTextFormatting.service";
import IConvoMemoryService, {ConvoError} from "../iService/telegramBot/iConvoMemory.service";
import IListsService from "../iService/telegramBot/IListsService";
import IPtService from "../iService/telegramBot/iPt.service";
import BotError from "./botError";
import IImageCommandsService from "../iService/iImageCommands.service";

@Service()
export default class BotService implements IBotService {

  constructor(
    @Inject(config.deps.service.inRequest.name) private inRequestService: IInRequestService,
    @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
    @Inject(config.deps.service.textFormatting.name) private textFormattingService: ITextFormattingService,
    @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
    @Inject(config.deps.service.lists.name) private listsService: IListsService,
    @Inject(config.deps.service.pt.name) private pt: IPtService,
    @Inject(config.deps.service.imageCommands.name) private imageCommands: IImageCommandsService,
  ) {
  }

  token = loadEnvVar('botToken');

  async run() {

    const bot = new Telegraf(this.token);

    // middleware (before all the other message treatment)
    bot.use(async (ctx, next) => {
      if (!ctx.chat) return;
      if (ctx.chat.type === 'channel') return; // ignore channel messages
      if (ctx.chat.type === 'group') {
        await ctx.reply(`I don't talk in groups. Please remove me.`);
        return;
      }

      if (ctx.chat.username)
        // save requester
        await this.inRequestService.addInRequest({id: ctx.chat.id, username: ctx.chat.username});
      else {
        await ctx.reply(`You don't look like a user... [\u{1FAD6}](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/418)`, {
          disable_web_page_preview: true,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (!this.botUtils.msgIsFromAdmin(ctx)) {
        const username = ctx.chat.username;
        if (await this.listsService.blacklist.contains(username)) {
          await ctx.reply(`You're blacklisted \u{1F620}`);
          return;
        }
        if (config.runningEnv === 'development') {
          await this.botUtils.sendMessage(this.botUtils.adminChatId, `@${username} tried to use the bot while in development.`);
          const isWhitelisted = await this.listsService.whitelist.contains(username);
          if (!isWhitelisted) {
            await ctx.reply(`Our beautiful devs are developing the bot at the moment. Please don't send messages. If using it is urgent, text @tovawr`);
            return;
          }
        }
      }

      try {
        await next();
      } catch (e) {
        if (e.name !== "BotError") await ctx.reply(`An error happened.`);
        await ctx.reply(e.message, {disable_web_page_preview: true});
        console.log(e.stack);
      }
    });

    this.pt.registerCommands(bot);
    this.listsService.registerCommands(bot);
    this.imageCommands.registerCommands(bot);

    //#region commands

    //#region info commands
    bot.command(`start`, ctx => ctx.reply(`
\u{1F1F5}\u{1F1F9} Bem-vindo, co-administrador dos @dezmincomjesus!
\u{1F1EC}\u{1F1E7}\u{1F1FA}\u{1F1F8} Welcome, fellow @tenminuteswithjesus admin!
\u{1F1EA}\u{1F1F8} Bienvenido, compañero administrador de @diezminutos!
\u{1F1EB}\u{1F1F7} Bienvenue, ami administrateur de @dixminutesavecjesus!
\u{1F1E9}\u{1F1EA} Willkommen, kollege des @zehnmmj!

Contact @tovawr for an implementation in your language!
Currently available languages: /pt

Anytime you do something you didn't mean to, use the /cancel command`));

    bot.command(`info`, ctx => ctx.replyWithHTML(`/info_pt instruções\n
Contact @tovawr for an implementation in your language!
Anyway, hit /start for an international welcome message \u{1F30F}\n
<b>Privacy notice</b>: The number of messages you send to the bot is saved since this is meant to be a \
more or less private bot.`));

    bot.command(`info_pt`, ctx => ctx.reply(`[Informação desatualizada]

Usa /pt para eu fazer uma formatação. Vais ter de enviar um texto \
e um áudio separadamente, por qualquer ordem, e eu respondo com tudo formatado.\n\nSempre que isto ficar confuso, usa \
/cancel; isso vai apagar todos os registos feitos sobre o teu chat, para poderes começar de novo.\n\nPara saberes \
que informações estão guardadas sobre o teu chat, /mystatus`));

    bot.command(`mystatus`, async ctx => {
      const convo = await this.convoService.wholeConvo(ctx.chat.id);
      await ctx.reply(JSON.stringify(convo || {}, null, 3));
    });

    //#endregion

    bot.command([`en`, `fr`, `es`, `de`], async ctx => {
      await ctx.replyWithHTML(`<b><i>Not implemented</i></b>\n/info`);
      await ctx.reply(`\u{1F937}\u{200D}\u{2642}\u{FE0F}`);
    });

    bot.command(`cancel`, async ctx => {
      await this.botUtils.deleteUserData(ctx.chat.id);
      await ctx.reply(`Ok irmom \u{1F5FF} registos apagados`);
    });

    bot.command(`debug`, async ctx => {
      if (config.runningEnv === `production`)
        throw new BotError(`\u{26D4} This command is not allowed in production mode \u{26D4}`);

      await ctx.reply(`nothin's testin`);
    });

    bot.command(`report`, async ctx => {
      if (!this.botUtils.msgIsFromAdmin(ctx)) {
        ctx.reply(`I can't report to you.`);
        return;
      }

      ctx.reply(this.textFormattingService.inRequestsToString(await this.inRequestService.getLastWeekRequests()));
    });

    bot.command([], ctx => ctx.reply(`Say what? I'm not recognizing that command.`));
    //#endregion

    //#region message treatment
    bot.on('audio', async ctx => {
      const chatId = ctx.chat.id;
      const exists = await this.convoService.exists(chatId);
      if (!exists) {
        // a command has not been used
        await ctx.reply(`só processo áudios para serem mandados para o Telegram, por isso tens de usar o comando /pt primeiro`);
        return;
      }

      const command = await this.convoService.getCommand(chatId) as string;
      if (this.pt.isPtCommand(command)) {
        //#region PT audio handling
        const hasAudio = await this.convoService.hasAudio(chatId);
        if (hasAudio === null)
          throw await ConvoError.new(this.convoService, chatId, 'hasAudio at handleAudio');
        if (hasAudio) {
          // audio was already received
          await ctx.reply(`já tinhas mandado áudio. manda aí texto`);
          return;
        }

        await ctx.reply(`péràí... a baixar`);
        await ctx.reply(`\u{1F4E5}`);
        await this.botUtils.getFile(ctx.message.audio.file_id);

        await this.convoService.setAudio(chatId, true);
        if (await this.convoService.getText(chatId))
          await this.pt.finally(ctx);
        else ctx.reply(`já tá! ganda meditação`);
        //#endregion

      } else await ctx.reply(`Command incompatible with media. Use /info to learn how to use the bot.`);
    });

    bot.on('photo', async ctx => {
      const chatId = ctx.chat.id;
      const exists = await this.convoService.exists(chatId);
      if (!exists) {
        ctx.reply(`You didn't use a command. I'll be ignoring this photo.`);
        return;
      }

      const command = await this.convoService.getCommand(chatId) as string;
      if (this.imageCommands.isImageCommand(command)) {
        //#region image command photo treatment
        const command = await this.convoService.getCommand(chatId);
        if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle photo');

        if (command !== 'img_add') throw new BotError(`Only images for the 'img_add' command are handled here.`);

        const a = ctx.message.photo[0];
        //todo fix
        const buffer = await this.botUtils.getFile(a.file_id);

        const res = await this.convoService.setImg(chatId, buffer);
        if (!res) throw new BotError('Image could not be loaded.');
        const data = await this.convoService.getAddImageData(chatId);
        if (data && data.image && data.name)
          await this.imageCommands.finallyAddImage(chatId, ctx);
        else ctx.reply('OK! falta o ID');
        //#endregion

      } else await ctx.reply(`This command doesn't want you to send photos.`);
    });

    bot.on('text', async ctx => {
      const chatId = ctx.chat.id;
      const exists = await this.convoService.exists(chatId);
      if (!exists) {
        // if a command hasn't been used, just return the formatted texts
        try {
          ctx.reply(`You should use a command before sending text.`);
          const texts = this.textFormattingService.getFullInfo(ctx.message.text);
          await ctx.reply(texts.telegram, {parse_mode: 'Markdown', disable_web_page_preview: true});
          await ctx.reply(texts.signal, {disable_web_page_preview: true});
          return;
        } catch (e) {
          if (e instanceof BotError) throw e;
          throw new BotError(`Invalid text. Please use a command.`);
        }
      }

      const command = await this.convoService.getCommand(chatId) as string;
      if (this.pt.isPtCommand(command)) {
        //#region PT command text handling
        if (await this.convoService.hasAudio(chatId)) {
          // if audio has been sent, join the audio and text, then reply with the formatted audio and Signal text
          await this.convoService.setText(chatId, this.textFormattingService.getFullInfo(ctx.message.text));
          await this.pt.finally(ctx);
        } else {
          if (await this.convoService.getText(chatId))
            // if we don't have audio but already have text, let the user know
            throw new BotError(`já tinhas mandado texto, agora tens de mandar áudio.\nou então /cancel`);
          const texts = this.textFormattingService.getFullInfo(ctx.message.text);
          await this.convoService.setText(chatId, texts);
          await ctx.reply(`boa escolha de emojis ${texts.descr1.split(` `)[0]}`);
        }
        //#endregion
      } else if (this.imageCommands.isImageCommand(command)) {
        //#region image command text handling
        const command = await this.convoService.getCommand(chatId);
        if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle photo');

        if (command === 'img_add') {
          const res = await this.convoService.setImgName(chatId, ctx.message.text);
          if (!res) throw new BotError(`Coudn't set the image name`);

          const data = await this.convoService.getAddImageData(chatId);
          if (data && data.image && data.name)
            await this.imageCommands.finallyAddImage(chatId, ctx);
          else ctx.reply('OK! falta a foto');
        }
        //#endregion
      } else ctx.reply(`Command incompatible with media. Use /info to learn how to use the bot.`);
    });
    //#endregion

    await bot.launch();

    // inform me that it's running
    await this.botUtils.sendMessage(this.botUtils.adminChatId, 'Bot is running in ' + config.runningEnv);
  }
}