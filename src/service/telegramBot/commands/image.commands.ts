import {Inject, Service} from "typedi";

import {Bot, File, ReplyQueue} from "../types/botgram";
import config from "../../../config";
import IConvoMemoryService, {ConvoError} from "../../iService/telegramBot/iConvoMemory.service";
import {messagePhoto, messageText} from "../types/model";
import IImageCommandsService from "../../iService/iImageCommands.service";
import IImageService from "../../iService/iImage.service";
import IListsService from "../../iService/telegramBot/IListsService";
import ImageDto from "../../../dto/image.dto";
import UniqueEntityID from "../../../domain/core/uniqueEntityId";
import BotError from "../botError";
import IBotUtilsService from "../../iService/telegramBot/iBotUtils.service";
import axios from "axios";
import * as fs from "fs";
import moment from "moment";

@Service()
export default class ImageCommands implements IImageCommandsService {

  constructor(
    @Inject(config.deps.service.lists.name) private listsService: IListsService,
    @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
    @Inject(config.deps.service.image.name) private imageService: IImageService,
    @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
  ) {
  }

  registerCommands(bot: Bot) {

    bot.command('img_add', async (msg, reply) => {
      await this.listsService.whitelist.onlyAdminsAllowed(msg, reply);
      const chatId = msg.chat.id;
      const existingConvo = await this.convoService.wholeConvo(chatId);
      if (existingConvo) {
        reply.text(`You were using the ${existingConvo.command} command. Wanna /cancel?`);
        return;
      }

      await this.convoService.set(chatId, {command: msg.command, data: {}});
      reply.text('OK. manda a imagem e o identificador');
    });

  }

  async handlePhoto(bot: Bot, msg: messagePhoto, reply: ReplyQueue): Promise<void> {
    const chatId = msg.chat.id;
    const command = await this.convoService.getCommand(chatId);
    if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle photo');

    if (command !== 'img_add') throw new BotError(`Only images for the 'img_add' command are handled here.`);

    // when the image is actually retrieved
    const file = await new Promise<File>((resolve, reject) =>
      bot.fileGet(msg.image.file.id, async (e, r) => {
        if (e || !r) {
          reject(e);
          return;
        }
        resolve(r);
      }));
    const response = await axios.get(`${this.botUtils.filesUrl}/${file.path}`, {responseType: "stream"});
    const fileName = moment().valueOf().toString() + '.jpg';
    response.data.pipe(fs.createWriteStream(fileName));

    async function tryReadFile(): Promise<Buffer> {
      console.count('try');
      try {
        return fs.readFileSync(fileName);
      } catch (e) {
        await new Promise(r => setTimeout(r, 50));
        return await tryReadFile();
      }
    }

    const buffer = await tryReadFile();
    fs.rmSync(fileName);

    const res = await this.convoService.setImg(chatId, buffer);
    if (!res) throw new BotError('Image could not be loaded.');
    const data = await this.convoService.getAddImageData(chatId);
    if (data && data.image && data.name)
      await this.finallyAddImage(chatId, reply);
    else reply.text('OK! falta o ID');
  }

  isImageCommand(command: string) {
    switch (command) {
      case 'img_add':
        return true;
      default:
        return false;
    }
  }

  async handleText(msg: messageText, reply: ReplyQueue): Promise<void> {
    const chatId = msg.chat.id;
    const command = await this.convoService.getCommand(chatId);
    if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle photo');

    if (command === 'img_add') {
      const res = await this.convoService.setImgName(chatId, msg.text);
      if (!res) throw new BotError(`Coudn't set the image name`);

      const data = await this.convoService.getAddImageData(chatId);
      if (data && data.image && data.name)
        await this.finallyAddImage(chatId, reply);
      else reply.text('OK! falta a foto');
    }
  }

  async finallyAddImage(chatId: number, reply: ReplyQueue) {
    const data = await this.convoService.getAddImageData(chatId);
    if (!data || !data.name || !data.image)
      throw new BotError('The image or the ID is missing.');
    const dto: ImageDto = {
      domainId: new UniqueEntityID().toString(),
      file: {
        domainId: new UniqueEntityID().toString(),
        file: data.image,
        id: data.name
      }
    };
    const res = await this.imageService.save(dto);
    reply.text('Guardada!');
  }

}