import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import moment from "moment";
import {Inject, Service} from "typedi";
import config from "../../../config";
import {filesFolder} from "../../../config/constants";
import UniqueEntityID from "../../../domain/core/unique-entity-id";
import ImageDto from "../../../dto/image.dto";
import IImageCommandsService from "../../i-service/i-image-commands.service";
import IImageEditingService from "../../i-service/i-image-editing.service";
import IImageService from "../../i-service/i-image.service";
import ISimpleUserService from "../../i-service/i-simpleUser.service";
import IBotUtilsService from "../../i-service/telegram-bot/i-bot-utils.service";
import IConvoMemoryService, {ConvoError} from "../../i-service/telegram-bot/i-convo-memory.service";
import IListsService from "../../i-service/telegram-bot/i-lists-service";
import BotError from "../bot-error";
import * as textFormatting from "../text-formatting.service";
import {Bot, File, ReplyQueue} from "../types/botgram";
import {messagePhoto, messageText} from "../types/model";

@Service()
export default class ImageCommands implements IImageCommandsService {

  constructor(
      @Inject(config.deps.service.lists.name) private listsService: IListsService,
      @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
      @Inject(config.deps.service.imageEditing.name) private imageEditingService: IImageEditingService,
      @Inject(config.deps.service.image.name) private imageService: IImageService,
      @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
      @Inject(config.deps.service.simpleUser.name) private simpleUserService: ISimpleUserService,
  ) {}

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
      const noCommand = msg.text.split(' ').slice(1);
      let offset: number | undefined = undefined;
      let title = noCommand.join(' ');
      const maybeOffset = Number(noCommand[0].slice(1, -1));
      if (noCommand[0].at(0) === '('
          && noCommand[0].at(-1) === ')'
          && !isNaN(maybeOffset)) {
        offset = maybeOffset;
        title = noCommand.slice(1).join(' ');
      }
      const { day, month, year } = textFormatting.theDate();
      moment.locale('pt-pt');
      const date = moment().date(day).month(month - 1).year(year).format("DD MMMM YYYY").toString();

      // getting the chosen photo or using the default photo
      const user = await this.simpleUserService.getUserById(msg.chat.id);
      const chosenPhotoId = user.chosenPhotoId;
      let photo;
      if (!chosenPhotoId)
        photo = fs.readFileSync(`${filesFolder}/rapaz.jpg`);
      else {
        const f = (await this.imageService.getById(chosenPhotoId))?.file.file;
        if (f) photo = f;
        else
          photo = fs.readFileSync(`${filesFolder}/rapaz.jpg`);
      }

      const generatedFile = await this.imageEditingService.generate(photo, date, title,
          { imgAlign: offset });
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

    bot.command('video', async (msg, reply) => {
      await this.listsService.whitelist.onlyAdminsAllowed(msg, reply);
      const chatId = msg.chat.id;
      const existingConvo = await this.convoService.wholeConvo(chatId);
      if (existingConvo) {
        reply.text(`You were using the ${existingConvo.command} command. Wanna /cancel?`);
        return;
      }

      reply.text('OK! agora um texto para o vídeo, e uma imagem');
    });

  }

  async imgAddHandlePhoto(chatId: number, reply: ReplyQueue, imgBuffer: Buffer) {
    const res = await this.convoService.setImg(chatId, imgBuffer);
    if (!res) throw new BotError('Image could not be loaded.');
    const data = await this.convoService.getAddImageData(chatId);
    if (data && data.image && data.name)
      await this.addImageToDb(chatId, reply);
    else reply.text('OK! falta o ID');
  }

  async videoHandlePhoto(chatId: number, reply: ReplyQueue, imgBuffer: Buffer) {
    await this.convoService.setVideoImage(chatId, imgBuffer)
    || (() => {throw new BotError('Image could not be saved to the DB');})();
    //todo
  }

  async handlePhoto(bot: Bot, msg: messagePhoto, reply: ReplyQueue): Promise<void> {
    const chatId = msg.chat.id;
    const command = await this.convoService.getCommand(chatId);
    if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle photo');

    if (command !== 'img_add' && command !== 'video')
      throw new BotError(`Only images for the 'img_add' command are handled here.`);

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

    if (command === 'img_add')
      await this.imgAddHandlePhoto(chatId, reply, buffer);
    if (command === 'video')
      await this.videoHandlePhoto(chatId, reply, buffer);
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
        await this.addImageToDb(chatId, reply);
      else reply.text('OK! falta a foto');
    }
  }

  async addImageToDb(chatId: number, reply: ReplyQueue) {
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
    await this.imageService.save(dto);
    reply.text('Guardada!');
  }

}