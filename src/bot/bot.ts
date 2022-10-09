import {Container} from "typedi";

import config from "../config";
import BotError from "./botError";
import {deleteUserData, markdownWithLinks, sendMessage, textWithLinks} from "./general";
import {Bot} from "./types/botgram";
import IInRequestService from "../service/iService/iInRequest.service";
import ITextFormattingService from "../service/iService/iTextFormatting.service";
import IConvoMemoryService from "../service/iService/iConvoMemory.service";
import IPtService from "../service/iService/iPt.service";

const botgram = require("botgram");

export default () => {

  const bot: Bot = botgram(config.botToken);

  const inRequestService = Container.get(config.deps.service.inRequest.name) as IInRequestService;
  const textFormattingService = Container.get(config.deps.service.textFormatting.name) as ITextFormattingService;
  const convoService = Container.get(config.deps.service.convoMemory.name) as IConvoMemoryService;
  const pt = Container.get(config.deps.service.pt.name) as IPtService;

  // middleware
  bot.all(async (msg, reply, next) => {
    if (msg.group) {
      reply.text(`I don't talk in groups. Please remove me.`);
      return;
    }

    if (config.runningEnv === 'development' && msg.chat.id.toString() !== config.adminChatId.toString()) {
      await sendMessage(config.adminChatId, `@${msg.chat.username} tried to use the bot while in development.`);
      await sendMessage(String(msg.chat.id), `Our beautiful devs are developing the bot at the moment. Please don't send messages.`);
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

  pt.registarComandos(bot);

  bot.command(`en`, `fr`, `es`, `de`, (msg, reply) => {
    reply.html(`<b><i>Not implemented</i></b>\n/info`);
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

  bot.command((msg, reply) => reply.text(`Say what? I'm not recognizing that command.`));
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

    const command = await convoService.getCommand(chatId);
    if (pt.isPtCommand(command)) {
      await pt.handleAudio(bot, msg, reply);
    } else reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
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

    const command = await convoService.getCommand(chatId);
    if (pt.isPtCommand(command))
      await pt.handleText(msg, reply);
    else reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
  });
  //#endregion

  //#region auxiliary methods

  //#endregion

}
