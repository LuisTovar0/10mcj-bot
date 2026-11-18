import { Inject, Service } from "typedi";
import config from "../../../config";
import IBlacklistRepo from "../../i-repos/i-blacklist.repo";
import IListRepo from "../../i-repos/i-list.repo";
import IWhitelistRepo from "../../i-repos/i-whitelist.repo";
import IBotUtilsService from "../../i-service/telegram-bot/i-bot-utils.service";
import IListsService from "../../i-service/telegram-bot/i-lists-service";
import BotError from "../bot-error";
import { parseTelegramUserId, privateSender } from "../telegram-user-id";
import { Bot, Message } from "../types/botgram";
import { messageCommand } from "../types/model";

@Service()
export default class ListsService implements IListsService {

  constructor(
      @Inject(config.deps.repo.whitelist.name) private whitelistRepo: IWhitelistRepo,
      @Inject(config.deps.repo.blacklist.name) private blacklistRepo: IBlacklistRepo,
      @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
  ) {}

  isAdmin(msg: Message): boolean {
    return privateSender(msg)?.id === this.botUtils.adminChatId;
  }

  private async isApproved(userId: number): Promise<boolean> {
    return userId === this.botUtils.adminChatId || await this.whitelistRepo.contains(userId);
  }

  async admission(userId: number): Promise<'allowed' | 'blocked' | 'development'> {
    if (await this.blacklistRepo.contains(userId)) return 'blocked';
    if (config.runningEnv !== 'development' || await this.isApproved(userId)) return 'allowed';
    return 'development';
  }

  async canEdit(msg: Message): Promise<boolean> {
    const sender = privateSender(msg);
    return !!sender && !(await this.blacklistRepo.contains(sender.id)) && await this.isApproved(sender.id);
  }

  async ensureEditor(msg: Message, activeWorkflow = false): Promise<void> {
    if (await this.canEdit(msg)) return;
    if (activeWorkflow) await this.botUtils.deleteUserData(msg.chat.id);
    throw new BotError('Only approved editors can use this command.');
  }

  registerCommands(bot: Bot): void {
    this.registerList(bot, 'whitelist', this.whitelistRepo);
    this.registerList(bot, 'blacklist', this.blacklistRepo);
  }

  private registerList(bot: Bot, name: string, repo: IListRepo): void {
    const ensureAdmin = (msg: messageCommand) => {
      if (!this.isAdmin(msg)) throw new BotError('Not allowed.');
    };
    const getUserId = (msg: messageCommand) => {
      const userId = parseTelegramUserId(msg.args());
      if (userId === undefined) throw new BotError(`Usage: /${ msg.command } <positive Telegram user ID>`);
      return userId;
    };

    bot.command(`${ name }_add`, async (msg, reply) => {
      ensureAdmin(msg);
      await repo.add(getUserId(msg));
      reply.text('Done');
    });

    bot.command(`${ name }_rm`, async (msg, reply) => {
      ensureAdmin(msg);
      const removed = await repo.remove(getUserId(msg));
      reply.text(removed ? 'Done' : 'This user ID is absent from the list.');
    });

    bot.command(`${ name }_all`, async (msg, reply) => {
      ensureAdmin(msg);
      const ids = await repo.fullList();
      reply.text(ids.join('\n') || 'List is empty');
    });
  }

}
