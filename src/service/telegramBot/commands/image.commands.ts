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
import fs from "fs";
import moment from "moment";
import {filesFolder} from "../../../config/constants";
import ITextFormattingService from "../../iService/telegramBot/iTextFormatting.service";
import IImageEditingService from "../../iService/iImageEditing.service";
import FormData from "form-data";
import ISimpleUserService from "../../iService/iSimpleUser.service";

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

  registerCommands(bot: Bot) {

    bot.command('images', async (_, reply) => {
      let isWhitelist;
      if (_.chat.username)
        isWhitelist = await this.listsService.whitelist.contains(_.chat.username);
      else isWhitelist = false;
      reply.markdown(`Bear in mind that most of these commands are reserved for admins.${isWhitelist ? `
You can view the available images and their ID's [here](https://one0mcj.onrender.com/images)` : ''}
/img\\_add - Add an image to the DB.
/img\\_offset - Change the offset value that will be applied to an image in thumbnail generation.`);
    });

    bot.command('img_add', async (msg, reply) => {
      await this.listsService.whitelist.onlyAdminsAllowed(msg, reply);
      const chatId = msg.chat.id;
      const existingConvo = await this.convoService.wholeConvo(chatId);
      if (existingConvo) {
        reply.text(`You were using the ${existingConvo.command} command. Wanna /cancel?`);
        return;
      }

      await this.convoService.set(chatId, { command: msg.command, data: {} });
      reply.text('OK. manda a imagem e o identificador');
    });

    bot.command(`pt_img`, async msg => {
      const title = msg.text.split(' ').slice(1).join(' ');
      const { day, month, year } = this.textFormattingService.theDate();
      moment.locale('pt-pt');
      const date = moment().date(day).month(month - 1).year(year).format("DD MMMM YYYY").toString();

      // getting the chosen photo or using the default photo
      const user = await this.simpleUserService.getUserById(msg.chat.id);
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
          fd, { params: { chat_id: msg.chat.id } });
      fs.unlinkSync(generatedFileName);
    });

    bot.command(`img_choose`, async (msg, reply) => {
      const imgId = msg.text.split(' ').slice(1).join(' ');
      const image = await this.imageService.getById(imgId);
      if (!image) {
        reply.text(`Image not found. check out the available image IDs [here](http://localhost:15000/images)`, 'Markdown');
        return;
      }
      await this.simpleUserService.choosePhoto(msg.chat.id, imgId);
      reply.text('Set \u{1F44D}');
    });

    bot.command('chosen_img', async (msg, reply) => {
      const user = await this.simpleUserService.getUserById(msg.chat.id);
      reply.text(user.chosenPhotoId ? user.chosenPhotoId : 'No image set. Default will be used.');
    });

  }

  async handlePhoto(bot: Bot, msg: messagePhoto, reply: ReplyQueue): Promise<void> {
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
    const response = await axios.get(`${this.botUtils.filesUrl}/${file.path}`, { responseType: "stream" });
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
        id: data.name,
      },
    };
    const res = await this.imageService.save(dto);
    reply.text('Guardada!');
  }

}
