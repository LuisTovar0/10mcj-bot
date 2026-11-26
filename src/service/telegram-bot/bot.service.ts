import { Inject, Service } from "typedi";
import config, { loadEnvVar } from "../../config";
import IImageCommandsService from "../i-service/i-image-commands.service";
import IInRequestService from "../i-service/i-in-request.service";
import IBotService from "../i-service/telegram-bot/i-bot-service";
import IBotUtilsService from "../i-service/telegram-bot/i-bot-utils.service";
import IConvoMemoryService from "../i-service/telegram-bot/i-convo-memory.service";
import IListsService from "../i-service/telegram-bot/i-lists-service";
import IPtService from "../i-service/telegram-bot/i-pt.service";
import BotError from "./bot-error";
import { BotMenu, menuButton, menuPrefix, type MenuHandler, type RegisterMenuAction } from "./bot-menu";
import { privateSender, type PrivateChatUpdate } from "./telegram-user-id";
import * as textFormatting from "./text-formatting.service";
import { Bot, ReplyQueue } from "./types/botgram";

const botgram = require("botgram");

@Service()
export default class BotService implements IBotService {

  private readonly pendingByChat = new Map<number, Promise<void>>();

  constructor(
      @Inject(config.deps.service.inRequest.name) private inRequestService: IInRequestService,
      @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
      @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
      @Inject(config.deps.service.lists.name) private listsService: IListsService,
      @Inject(config.deps.service.pt.name) private pt: IPtService,
      @Inject(config.deps.service.imageCommands.name) private imageCommands: IImageCommandsService,
  ) {
  }

  token = loadEnvVar('botToken');

  async run() {
    const bot: Bot = botgram(this.token);
    this.registerCommands(bot);
    await this.botUtils.sendMessage(this.botUtils.adminChatId, 'Bot is running in ' + config.runningEnv);
  }

  registerCommands(bot: Bot): void {
    const menu = new BotMenu(bot);
    const processUpdate = bot.processUpdate.bind(bot);
    bot.processUpdate = update => {
      // Botgram expects a full Message, but Telegram returns only the ID, chat and date for inaccessible messages.
      if (update.callback_query?.message?.date === 0) delete update.callback_query.message;
      return processUpdate(update);
    };

    const menuActions = new Map<string, MenuHandler>();
    const registerMenuAction: RegisterMenuAction = (action, handler, slashCommand = true) => {
      menuActions.set(`${ menuPrefix }${ action }`, handler);
      if (slashCommand) bot.command(action, handler);
    };

    // middleware (before all the other message treatment)
    bot.all((msg, reply, next) => {
      if (msg.chat.type === 'channel') return; // ignore channel messages
      if (msg.group) {
        reply.text(`I don't talk in groups. Please remove me.`);
        return;
      }

      return this.handlePrivateUpdate(msg, reply, menu, next);
    });

    bot.callback(query => {
      const message = query.message;
      const data = query.data ?? '';
      const answer = (accepted: boolean) => {
        query.answer(accepted ? {} : {
          text: 'Este botão já não está disponível. Usa os botões mais recentes ou abre /menu.',
          alert: true,
        }, error => {
          if (error) console.error('Could not acknowledge a Telegram button press.');
        });
      };
      if (!message || message.chat.type !== 'user' || message.chat.id !== query.from.id || !data.startsWith(menuPrefix)) {
        answer(false);
        return;
      }

      const { chat } = message;
      const update = { chat, from: query.from };
      const reply = bot.reply(chat.id);
      const action = menuActions.get(data);
      return this.handlePrivateUpdate(update, reply, menu, () => action?.(update), () => {
        const accepted = menu.consume(chat.id, message.id, data) && !!action;
        answer(accepted);
        return accepted;
      });
    });

    this.pt.registerCommands(menu, registerMenuAction);
    this.listsService.registerCommands(bot);
    this.imageCommands.registerCommands(bot, menu, registerMenuAction);

    const menuKeyboard = async (update: PrivateChatUpdate) => {
      const rows = [
        [ menuButton('Pré-visualizar meditação', 'pt_testar') ],
        [ menuButton('Criar capa para YouTube', 'pt_img') ],
      ];
      if (this.pt.isPtCommand('pt_enviar') && await this.listsService.canEdit(update)) {
        rows.push([ menuButton('Publicar meditação no canal', 'pt_enviar') ]);
      }
      rows.push([ menuButton('Imagens', 'images'), menuButton('Ajuda', 'info') ]);
      return rows;
    };

    const showMenu: MenuHandler = async update => {
      await menu.send(update.chat.id, 'O que queres fazer?', await menuKeyboard(update));
    };
    registerMenuAction('menu', showMenu);
    bot.command('pt', showMenu);

    //#region commands

    //#region info commands
    bot.command(`start`, async msg => {
      await menu.send(msg.chat.id, `
\u{1F1F5}\u{1F1F9} Bem-vindo, co-administrador dos @dezmincomjesus!
\u{1F1EC}\u{1F1E7}\u{1F1FA}\u{1F1F8} Welcome, fellow @tenminuteswithjesus admin!
\u{1F1EA}\u{1F1F8} Bienvenido, compañero administrador de @diezminutos!
\u{1F1EB}\u{1F1F7} Bienvenue, ami administrateur de @dixminutesavecjesus!
\u{1F1E9}\u{1F1EA} Willkommen, kollege des @zehnmmj!

Escolhe uma opção abaixo ou usa /menu. Para cancelar uma tarefa, usa /cancel.
Contact @tovawr for an implementation in your language!`, await menuKeyboard(msg));
    });

    const showHelp: MenuHandler = msg => {
      return menu.send(msg.chat.id,
          'Para pré-visualizar uma meditação, envia o áudio e o texto em duas mensagens. Também podes enviar só o texto para receber as versões formatadas para Telegram e Signal.\n\n' +
          'Para criar uma capa para YouTube, escolhe uma opção em Imagens ou usa /pt_img ou /pt_img_ai. ' +
          'Podes escrever o título no comando ou enviá-lo quando o bot o pedir. Revê a foto de fundo, o título e a data, ' +
          'altera o que precisares e carrega em CRIAR IMAGEM.\n\n' +
          'Para mudar a data, toca em Alterar data e envia a nova data no formato DD/MM/AAAA.\n\n' +
          'Para mudar o fundo, envia uma foto ou indica um ID da galeria. Também podes usar /img_choose ID durante a tarefa. ' +
          'O bot volta a sugerir o fundo da última capa que recebeste. Usa /chosen_img para veres o fundo predefinido.\n\n' +
          'Usa /menu para veres as opções e /cancel para cancelares uma tarefa.\n\n' +
          'O bot regista a tua atividade para contar as interações. Para ajuda, fala com @tovawr.',
          [ [ menuButton('Voltar ao menu', 'menu') ] ],
      );
    };
    registerMenuAction('info', showHelp);
    bot.command('help', 'info_pt', showHelp);

    bot.command(`mystatus`, async (msg, reply) => {
      const convo = await this.convoService.wholeConvo(msg.chat.id);
      reply.text(JSON.stringify(convo || {}, null, 3));
    });

    //#endregion

    bot.command(`en`, `fr`, `es`, `de`, (msg, reply) => {
      reply.html(`<b><i>Not implemented</i></b>\n/info`);
      reply.text(`\u{1F937}\u{200D}\u{2642}\u{FE0F}`);
    });

    registerMenuAction('cancel', msg => this.cancelWorkflow(msg.chat.id, menu));

    bot.command(`debug`, async (msg, reply) => {
      if (config.runningEnv === `production`)
        throw new BotError(`\u{26D4} This command is not allowed in production mode \u{26D4}`);

      reply.text(`nothin's testin`);
    });

    bot.command(`report`, async (msg, reply) => {
      if (!this.listsService.isAdmin(msg)) {
        reply.text(`I can't report to you.`);
        return;
      }

      reply.text(textFormatting.inRequestsToString(await this.inRequestService.getLastWeekRequests()));
    });

    bot.command(msg => menu.send(msg.chat.id, 'Comando desconhecido.', [ [ menuButton('Abrir menu', 'menu') ] ]));
    //#endregion

    //#region message treatment
    bot.audio(async (msg, reply) => {
      const chatId = msg.chat.id;
      const exists = await this.convoService.exists(chatId);
      if (!exists) {
        // a command has not been used
        await menu.send(chatId, 'Para usar este áudio, escolhe uma tarefa no menu e volta a enviá-lo.', [ [ menuButton('Abrir menu', 'menu') ] ]);
        return;
      }

      const command = await this.convoService.getCommand(chatId) as string;
      if (this.pt.isPtCommand(command)) {
        await this.pt.handleAudio(bot, msg, reply, menu);
      } else if (!await this.imageCommands.handleOtherInput(bot, msg, menu)) {
        reply.text('Esta tarefa não aceita áudio. Segue as instruções da tarefa ou usa /cancel.');
      }
    });

    bot.photo(async (msg, reply) => {
      const chatId = msg.chat.id;
      const exists = await this.convoService.exists(chatId);
      if (!exists) {
        await menu.send(chatId, 'Para usar esta imagem, escolhe uma tarefa no menu e volta a enviá-la.', [ [ menuButton('Abrir menu', 'menu') ] ]);
        return;
      }

      const command = await this.convoService.getCommand(chatId) as string;
      if (this.imageCommands.isImageCommand(command))
        await this.imageCommands.handlePhoto(bot, msg, reply, menu);
      else reply.text(`This command doesn't want you to send photos.`);
    });

    bot.text(async (msg, reply) => {
      const chatId = msg.chat.id;
      const exists = await this.convoService.exists(chatId);
      if (!exists) {
        // if a command hasn't been used, just return the formatted texts
        try {
          const texts = textFormatting.getFullInfo(msg.text);
          this.botUtils.markdownHideLinks(reply, texts.telegram);
          this.botUtils.textHideLinks(reply, texts.signal);
          return;
        } catch (e) {
          if (e instanceof BotError) throw e;
          await menu.send(chatId, 'Não consegui formatar esse texto. Abre o menu para escolher uma tarefa.', [ [ menuButton('Abrir menu', 'menu') ] ]);
          return;
        }
      }

      const command = await this.convoService.getCommand(chatId) as string;
      if (this.pt.isPtCommand(command))
        await this.pt.handleText(msg, reply, menu);
      else if (this.imageCommands.isImageCommand(command))
        await this.imageCommands.handleText(bot, msg, menu);
      else reply.text(`Command incompatible with media. Use /info to learn how to use the bot.`);
    });

    bot.message(msg => this.imageCommands.handleOtherInput(bot, msg, menu));
    //#endregion

  }

  private async cancelWorkflow(chatId: number, menu: BotMenu): Promise<void> {
    const active = await this.convoService.exists(chatId);
    await this.botUtils.deleteUserData(chatId);
    await menu.send(chatId, active ? 'Tarefa cancelada.' : 'Não tens nenhuma tarefa em curso.', [ [ menuButton('Voltar ao menu', 'menu') ] ]);
  }

  private async handlePrivateUpdate(update: PrivateChatUpdate, reply: ReplyQueue, menu: BotMenu,
                                    next: () => void | Promise<void>, checkButton?: () => boolean): Promise<void> {
    const sender = privateSender(update);
    if (!sender) {
      reply.text(`Only available to users...`);
      return;
    }

    // Botgram dispatches messages and callback queries independently.
    const chatId = update.chat.id;
    const pending = (this.pendingByChat.get(chatId) ?? Promise.resolve()).then(async () => {
      try {
        if (checkButton && !checkButton()) return;
        const admission = await this.listsService.admission(sender.id);
        if (admission !== 'allowed' && await this.convoService.exists(chatId))
          await this.botUtils.deleteUserData(chatId);
        if (admission === 'blocked') {
          reply.text(`You're blacklisted \u{1F620}`);
          return;
        }

        if (config.runningEnv === 'development' && !this.listsService.isAdmin(update)) {
          const displayName = sender.username ? `@${ sender.username }` : String(sender.id);
          await this.botUtils.sendMessage(this.botUtils.adminChatId, `${ displayName } tried to use the bot while in development.`);
        }
        if (admission === 'development') {
          reply.text(`Our beautiful devs are developing the bot at the moment. Please don't send messages. If using it is urgent, text @tovawr`);
          return;
        }

        await this.inRequestService.addInRequest({ id: sender.id, username: sender.username });
        await next();
      } catch (e) {
        if (!(e instanceof BotError)) {
          reply.text(`An error happened.`);
          console.error(e.name, e.message);
        } else {
          this.botUtils.textHideLinks(reply, e.message);
        }
      } finally {
        await menu.retireEndedWorkflow(chatId, this.convoService);
      }
    });
    this.pendingByChat.set(chatId, pending);

    try {
      await pending;
    } finally {
      if (this.pendingByChat.get(chatId) === pending) this.pendingByChat.delete(chatId);
    }
  }
}
