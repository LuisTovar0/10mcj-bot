import {Inject, Service} from "typedi";
import IWhitelistService from "../iService/iWhitelist.service";
import config from "../../config";
import IWhitelistRepo from "../iRepos/iWhitelist.repo";
import {Bot} from "../../bot/types/botgram";
import {ensureMsgIsFromAdmin} from "../../bot/general";
import ISimpleUserService from "../iService/iSimpleUser.service";

@Service()
export default class WhitelistService implements IWhitelistService {

  constructor(
    @Inject(config.deps.repo.whitelist.name) private repo: IWhitelistRepo,
    @Inject(config.deps.service.simpleUser.name) private userService: ISimpleUserService,
  ) {
  }

  isWhitelistCommand(command: string): boolean {
    throw new Error("Method not implemented.");
  }

  registerCommands(bot: Bot) {

    bot.command(`whitelist_add`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const split = msg.text.split(' ');
      if (split.length < 2) {
        reply.text(`Comando mal usado. Formato correto é:`);
        reply.text(`/whitelist_add <username>`)
        return;
      }
      const username = split[1];
      try {
        await this.userService.getByUsername(username);
      } catch (e) {
        reply.text(`\u{26A0} Warning: user has not used bot.`)
      }
      await this.repo.add(username);
      reply.text('Done');
    });

    bot.command(`whitelist_rm`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const split = msg.text.split(' ');
      if (split.length < 2) {
        reply.text(`Comando mal usado. Formato correto é:`);
        reply.text(`/whitelist_rm <username>`)
        return;
      }
      const username = split[1];
      if (await this.repo.isWhitelisted(username)) {
        await this.repo.remove(username);
        reply.text('Done');
        return;
      }
      reply.text(`This username is not whitelisted.`)
      return;
    });

    bot.command(`whitelist_all`, async (msg, reply) => {
      ensureMsgIsFromAdmin(msg);

      const list = await this.repo.fullWhitelist();
      const str = list.reduce((accum, curr) => `${accum}\n@${curr}`, '');
      reply.text(str)
    })

  }

}
