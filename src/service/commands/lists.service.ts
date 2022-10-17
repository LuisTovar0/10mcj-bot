import {Inject, Service} from "typedi";
import IListsService from "../iService/IListsService";
import config from "../../config";
import IWhitelistRepo from "../iRepos/iWhitelist.repo";
import {Bot, ReplyQueue} from "../../bot/types/botgram";
import {ensureMsgIsFromAdmin} from "../../bot/general";
import ISimpleUserService from "../iService/iSimpleUser.service";
import {messageCommand} from "../../bot/types/model";
import BotError from "../../bot/botError";
import IBlacklistRepo from "../iRepos/iBlacklist.repo";

@Service()
export default class ListsService implements IListsService {

  constructor(
    @Inject(config.deps.repo.whitelist.name) private whitelistRepo: IWhitelistRepo,
    @Inject(config.deps.repo.blacklist.name) private blacklistRepo: IBlacklistRepo,
    @Inject(config.deps.service.simpleUser.name) private userService: ISimpleUserService,
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

    function analisa(msg: messageCommand, reply: ReplyQueue) {
      const split = msg.text.split(' ');
      if (split.length < 2)
        throw new BotError(`Comando mal usado. Formato correto é: /${msg.command} <username>`)

      return split[1];
    }

    bot.command(`whitelist_add`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const username = analisa(msg, reply)
      try {
        await this.userService.getByUsername(username);
      } catch (e) {
        reply.text(`\u{26A0} Warning: user has not used bot.`)
      }
      await this.whitelistRepo.add(username);
      reply.text('Done');
    });

    bot.command(`whitelist_rm`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const username = analisa(msg, reply);
      if (await this.whitelistRepo.contains(username)) {
        await this.whitelistRepo.remove(username);
        reply.text('Done');
        return;
      }
      reply.text(`This username is not whitelisted.`)
    });

    bot.command(`whitelist_all`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const list = await this.whitelistRepo.fullList();
      const str = list.reduce((accum, curr) => `${accum}\n@${curr}`, '');
      reply.text(str || 'List is empty')
    })

    bot.command(`blacklist_add`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const username = analisa(msg, reply);
      try {
        await this.userService.getByUsername(username);
      } catch (e) {
        reply.text(`\u{26A0} Warning: user has not used bot.`)
      }
      await this.blacklistRepo.add(username)
      reply.text('Done');
    })

    bot.command(`blacklist_rm`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const username = analisa(msg, reply);
      if (await this.blacklistRepo.contains(username)) {
        await this.blacklistRepo.remove(username);
        reply.text('Done');
        return;
      }
      reply.text(`This username is not blacklisted.`);
    })

    bot.command(`blacklist_all`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const list = await this.blacklistRepo.fullList();
      const str = list.reduce((accum, curr) => `${accum}\n@${curr}`, '');
      reply.text(str || 'List is empty')
    })

  }

}
