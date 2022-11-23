import {Inject, Service} from "typedi";
import IListsService from "../../iService/telegramBot/IListsService";
import config from "../../../config";
import IWhitelistRepo from "../../iRepos/iWhitelist.repo";
import ISimpleUserService from "../../iService/iSimpleUser.service";
import BotError from "../botError";
import IBlacklistRepo from "../../iRepos/iBlacklist.repo";
import IBotUtilsService from "../../iService/telegramBot/iBotUtils.service";
import {Telegraf} from "telegraf";

@Service()
export default class ListsService implements IListsService {

  constructor(
    @Inject(config.deps.repo.whitelist.name) private whitelistRepo: IWhitelistRepo,
    @Inject(config.deps.repo.blacklist.name) private blacklistRepo: IBlacklistRepo,
    @Inject(config.deps.service.simpleUser.name) private userService: ISimpleUserService,
    @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
  ) {
  }

  get whitelist() {
    return this.whitelistRepo
  }

  get blacklist() {
    return this.blacklistRepo
  }

  isListsCommand(command: string): boolean {
    throw new Error("Method not implemented.");
  }

  registerCommands(bot: Telegraf) {

    function analisa(text: string) {
      const split = text.split(' ');
      if (split.length < 2)
        throw new BotError(`Comando mal usado. Formato correto é: /${split[0]} <username>`);

      return split[1];
    }

    bot.command(`whitelist_add`, async ctx => {
      // this.botUtils.ensureMsgIsFromAdmin(msg);

      const username = analisa(ctx.message.text);
      try {
        await this.userService.getByUsername(username);
      } catch (e) {
        ctx.reply(`\u{26A0} Warning: user has not used bot.`);
      }
      await this.whitelistRepo.add(username);
      ctx.reply('Done');
    });

    bot.command(`whitelist_rm`, async ctx => {
      // this.botUtils.ensureMsgIsFromAdmin(msg);

      const username = analisa(ctx.message.text);
      if (await this.whitelistRepo.contains(username)) {
        await this.whitelistRepo.remove(username);
        ctx.reply('Done');
        return;
      }
      ctx.reply(`This username is not whitelisted.`);
    });

    bot.command(`whitelist_all`, async ctx => {
      // this.botUtils.ensureMsgIsFromAdmin(msg);

      const list = await this.whitelistRepo.fullList();
      const str = list.reduce((accum, curr) => `${accum}\n@${curr}`, '');
      ctx.reply(str || 'List is empty');
    });

    bot.command(`blacklist_add`, async ctx => {
      // this.botUtils.ensureMsgIsFromAdmin(msg);

      const username = analisa(ctx.message.text);
      try {
        await this.userService.getByUsername(username);
      } catch (e) {
        ctx.reply(`\u{26A0} Warning: user has not used bot.`);
      }
      await this.blacklistRepo.add(username);
      ctx.reply('Done');
    });

    bot.command(`blacklist_rm`, async ctx => {
      // this.botUtils.ensureMsgIsFromAdmin(msg);

      const username = analisa(ctx.message.text);
      if (await this.blacklistRepo.contains(username)) {
        await this.blacklistRepo.remove(username);
        ctx.reply('Done');
        return;
      }
      ctx.reply(`This username is not blacklisted.`);
    });

    bot.command(`blacklist_all`, async ctx => {
      // this.botUtils.ensureMsgIsFromAdmin(msg);

      const list = await this.blacklistRepo.fullList();
      const str = list.reduce((accum, curr) => `${accum}\n@${curr}`, '');
      ctx.reply(str || 'List is empty');
    });

  }

}
