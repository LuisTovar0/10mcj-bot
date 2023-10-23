import {Inject, Service} from "typedi";
import IListsService from "../../iService/telegramBot/i-lists-service";
import config from "../../../config";
import IWhitelistRepo from "../../iRepos/i-whitelist.repo";
import {Bot} from "../types/botgram";
import ISimpleUserService from "../../iService/i-simpleUser.service";
import {messageCommand} from "../types/model";
import BotError from "../botError";
import IBlacklistRepo from "../../iRepos/i-blacklist.repo";
import IBotUtilsService from "../../iService/telegramBot/i-bot-utils.service";

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

  registerCommands(bot: Bot) {

    function analisa(msg: messageCommand) {
      const split = msg.text.split(' ');
      if (split.length < 2)
        throw new BotError(`Comando mal usado. Formato correto é: /${msg.command} <username>`);

      return split[1];
    }

    bot.command(`whitelist_add`, async (msg, reply) => {
      this.botUtils.ensureMsgIsFromAdmin(msg);

      const username = analisa(msg);
      try {
        await this.userService.getByUsername(username);
      } catch (e) {
        reply.text(`\u{26A0} Warning: user has not used bot.`)
      }
      await this.whitelistRepo.add(username);
      reply.text('Done');
    });

    bot.command(`whitelist_rm`, async (msg, reply) => {
      this.botUtils.ensureMsgIsFromAdmin(msg);

      const username = analisa(msg);
      if (await this.whitelistRepo.contains(username)) {
        await this.whitelistRepo.remove(username);
        reply.text('Done');
        return;
      }
      reply.text(`This username is not whitelisted.`)
    });

    bot.command(`whitelist_all`, async (msg, reply) => {
      this.botUtils.ensureMsgIsFromAdmin(msg);

      const list = await this.whitelistRepo.fullList();
      const str = list.reduce((accum, curr) => `${accum}\n@${curr}`, '');
      reply.text(str || 'List is empty')
    })

    bot.command(`blacklist_add`, async (msg, reply) => {
      this.botUtils.ensureMsgIsFromAdmin(msg);

      const username = analisa(msg);
      try {
        await this.userService.getByUsername(username);
      } catch (e) {
        reply.text(`\u{26A0} Warning: user has not used bot.`)
      }
      await this.blacklistRepo.add(username)
      reply.text('Done');
    })

    bot.command(`blacklist_rm`, async (msg, reply) => {
      this.botUtils.ensureMsgIsFromAdmin(msg);

      const username = analisa(msg);
      if (await this.blacklistRepo.contains(username)) {
        await this.blacklistRepo.remove(username);
        reply.text('Done');
        return;
      }
      reply.text(`This username is not blacklisted.`);
    })

    bot.command(`blacklist_all`, async (msg, reply) => {
      this.botUtils.ensureMsgIsFromAdmin(msg);

      const list = await this.blacklistRepo.fullList();
      const str = list.reduce((accum, curr) => `${accum}\n@${curr}`, '');
      reply.text(str || 'List is empty')
    })

  }

}
