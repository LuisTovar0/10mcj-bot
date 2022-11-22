import {Inject, Service} from "typedi";

import config from "../../../config";
import IConvoMemoryService, {ConvoError} from "../../iService/telegramBot/iConvoMemory.service";
import IImageCommandsService from "../../iService/iImageCommands.service";
import IImageService from "../../iService/iImage.service";
import IListsService from "../../iService/telegramBot/IListsService";
import ImageDto from "../../../dto/image.dto";
import UniqueEntityID from "../../../domain/core/uniqueEntityId";
import BotError from "../botError";
import IBotUtilsService from "../../iService/telegramBot/iBotUtils.service";
import axios from "axios";
import fs from "fs";
import moment from "moment";
import {filesFolder} from "../../../config/constants";
import ITextFormattingService from "../../iService/telegramBot/iTextFormatting.service";
import IImageEditingService from "../../iService/iImageEditing.service";
import FormData from "form-data";
import ISimpleUserService from "../../iService/iSimpleUser.service";
import {Telegraf} from "telegraf";

@Service()
export default class ImageCommands implements IImageCommandsService {

  constructor(
    @Inject(config.deps.service.lists.name) private listsService: IListsService,
    @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
    @Inject(config.deps.service.textFormatting.name) private textFormattingService: ITextFormattingService,
    @Inject(config.deps.service.imageEditing.name) private imageEditingService: IImageEditingService,
    @Inject(config.deps.service.image.name) private imageService: IImageService,
    @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
    @Inject(config.deps.service.simpleUser.name) private simpleUserService: ISimpleUserService,
  ) {
  }

  registerCommands(bot: Telegraf) {

    bot.command('img_add', async ctx => {
      // await this.listsService.whitelist.onlyAdminsAllowed(ctx.chat.id); //todo
      const chatId = ctx.chat.id;
      const existingConvo = await this.convoService.wholeConvo(chatId);
      if (existingConvo) {
        ctx.reply(`You were using the ${existingConvo.command} command. Wanna /cancel?`);
        return;
      }

      await this.convoService.set(chatId, {command: ctx.message.text, data: {}});
      ctx.reply('OK. manda a imagem e o identificador');
    });

    bot.command(`pt_img`, async ctx => {
      const title = ctx.message.text.split(' ').slice(1).join(' ');
      const {day, month, year} = this.textFormattingService.theDate();
      moment.locale('pt-pt');
      const date = moment().date(day).month(month).year(year).format("DD MMMM YYYY").toString();

      // getting the chosen photo or using the default photo
      const user = await this.simpleUserService.getUserById(ctx.chat.id);
      const chosenPhotoId = user.chosenPhotoId;
      let photo;
      if (chosenPhotoId) {
        const f = (await this.imageService.getById(chosenPhotoId))?.file.file;
        if (f) photo = f;
        else
          photo = fs.readFileSync(`${filesFolder}/rapaz.jpg`);
      } else {
        photo = fs.readFileSync(`${filesFolder}/rapaz.jpg`);
      }

      const generatedFile = await this.imageEditingService.generate(photo, date, title);
      const generatedFileName = `./${moment().valueOf()}.png`;
      fs.writeFileSync(generatedFileName, generatedFile);
      const fd = new FormData();
      fd.append('photo', fs.createReadStream(generatedFileName));
      await axios.post(`${this.botUtils.methodsUrl}/sendPhoto`,
        fd, {params: {chat_id: ctx.chat.id}});
      fs.unlinkSync(generatedFileName);
    });

    bot.command(`img_choose`, async ctx => {
      const imgId = ctx.message.text.split(' ').slice(1).join(' ');
      const image = await this.imageService.getById(imgId);
      if (!image) {
        ctx.reply(`Image not found. check out the available image IDs [here](http://localhost:15000/images)`, {parse_mode: 'Markdown'});
        return;
      }
      await this.simpleUserService.choosePhoto(ctx.chat.id, imgId);
      ctx.reply('Set \u{1F44D}');
    });

    bot.command('chosen_img', async ctx => {
      const user = await this.simpleUserService.getUserById(ctx.chat.id);
      ctx.reply(user.chosenPhotoId ? user.chosenPhotoId : 'No image set. Default will be used.');
    });

  }

  async handlePhoto(bot: Telegraf, msg: messagePhoto, reply: ReplyQueue): Promise<void> {
    const chatId = msg.chat.id;
    const command = await this.convoService.getCommand(chatId);
    if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle photo');

    if (command !== 'img_add') throw new BotError(`Only images for the 'img_add' command are handled here.`);

    //#region retrieving the image
    //todo make it faster
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
    const tryReadFile = async (): Promise<Buffer> => {
      console.count('try read file');
      try {
        return fs.readFileSync(fileName);
      } catch (e) {
        await new Promise(r => setTimeout(r, 50));
        return await tryReadFile();
      }
    };
    const buffer = await tryReadFile();
    fs.rmSync(fileName);
    //#endregion

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