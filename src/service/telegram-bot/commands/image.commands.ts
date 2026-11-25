import fs from "fs";
import moment from "moment";
import { Inject, Service } from "typedi";
import config from "../../../config";
import { filesFolder } from "../../../config/constants";
import UniqueEntityID from "../../../domain/core/unique-entity-id";
import ImageDto from "../../../dto/image.dto";
import IImageCommandsService from "../../i-service/i-image-commands.service";
import IImageEditingService from "../../i-service/i-image-editing.service";
import IImageService from "../../i-service/i-image.service";
import ISimpleUserService from "../../i-service/i-simpleUser.service";
import IBotUtilsService from "../../i-service/telegram-bot/i-bot-utils.service";
import IConvoMemoryService, { ConvoError } from "../../i-service/telegram-bot/i-convo-memory.service";
import IListsService from "../../i-service/telegram-bot/i-lists-service";
import BotError from "../bot-error";
import { type BotMenu, menuButton, type MenuHandler, type RegisterMenuAction, startWorkflow } from "../bot-menu";
import * as textFormatting from "../text-formatting.service";
import { Bot, Message, ReplyQueue } from "../types/botgram";
import { messagePhoto, messageText } from "../types/model";

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

  registerCommands(bot: Bot, menu: BotMenu, registerMenuAction: RegisterMenuAction): void {
    registerMenuAction('images', async msg => {
      const canEdit = await this.listsService.canEdit(msg);
      const rows = [ [ menuButton('Criar capa para YouTube', 'pt_img') ] ];
      if (canEdit) rows.push([ menuButton('Adicionar imagem à galeria', 'img_add') ]);
      rows.push([ menuButton('Voltar ao menu', 'menu') ]);
      await menu.send(msg.chat.id, 'Imagens para as capas dos vídeos.', rows);
    });

    registerMenuAction('img_add', async msg => {
      await this.listsService.ensureEditor(msg);
      await startWorkflow(this.convoService, menu, msg.chat.id, { command: 'img_add', data: {} },
          'Envia a foto e o identificador que queres dar-lhe em duas mensagens.');
    });

    const startThumbnail: MenuHandler = msg => startWorkflow(this.convoService, menu, msg.chat.id,
        { command: 'pt_img', data: {} }, 'Envia o título que queres pôr na capa do vídeo.');
    registerMenuAction('pt_img', startThumbnail, false);

    bot.command('pt_img', async msg => {
      const title = msg.args().trim();
      if (!title) {
        await startThumbnail(msg);
        return;
      }

      const offset = /^\((\S*?)\)(?:\s+|$)/.exec(title);
      if (offset && !isNaN(Number(offset[1]))) {
        const titleWithoutOffset = title.slice(offset[0].length);
        if (!titleWithoutOffset) throw new BotError('Escreve o título da capa a seguir ao valor do alinhamento.');
        await this.sendThumbnail(msg.chat.id, titleWithoutOffset, Number(offset[1]));
      } else {
        await this.sendThumbnail(msg.chat.id, title);
      }
      if (await this.convoService.getCommand(msg.chat.id) === 'pt_img') await this.convoService.delete(msg.chat.id);
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
      await this.listsService.ensureEditor(msg);
      const chatId = msg.chat.id;
      const existingConvo = await this.convoService.wholeConvo(chatId);
      if (existingConvo) {
        reply.text(`You were using the ${ existingConvo.command } command. Wanna /cancel?`);
        return;
      }

      reply.text('OK! agora um texto para o vídeo, e uma imagem');
    });

  }

  private async sendThumbnail(chatId: number, title: string, offset?: number): Promise<void> {
    const { day, month, year } = textFormatting.theDate();
    moment.locale('pt-pt');
    const date = moment().date(day).month(month - 1).year(year).format('DD MMMM YYYY');
    const { chosenPhotoId } = await this.simpleUserService.getUserById(chatId);
    const chosenPhoto = chosenPhotoId ? (await this.imageService.getById(chosenPhotoId))?.file.file : undefined;
    const photo = chosenPhoto ?? fs.readFileSync(`${ filesFolder }/rapaz.jpg`);
    const thumbnail = await this.imageEditingService.generate(photo, date, title, { imgAlign: offset });
    const form = new FormData();
    form.set('photo', new Blob([ new Uint8Array(thumbnail) ], { type: 'image/png' }), 'capa.png');
    form.set('chat_id', String(chatId));
    await this.botUtils.apiMethod('sendPhoto', form);
  }

  private async imgAddHandlePhoto(msg: messagePhoto, menu: BotMenu, imgBuffer: Buffer) {
    const chatId = msg.chat.id;
    const res = await this.convoService.setImg(chatId, imgBuffer);
    if (!res) throw new BotError('Image could not be loaded.');
    const data = await this.convoService.getAddImageData(chatId);
    if (data && data.image && data.name)
      await this.addImageToDb(msg, menu);
    else await menu.prompt(chatId, await this.convoService.wholeConvo(chatId), 'Foto recebida. Agora envia o identificador.');
  }

  async videoHandlePhoto(chatId: number, reply: ReplyQueue, imgBuffer: Buffer) {
    await this.convoService.setVideoImage(chatId, imgBuffer)
    || (() => {throw new BotError('Image could not be saved to the DB');})();
    //todo
  }

  async handlePhoto(bot: Bot, msg: messagePhoto, reply: ReplyQueue, menu: BotMenu): Promise<void> {
    const chatId = msg.chat.id;
    const command = await this.convoService.getCommand(chatId);
    if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle photo');
    if (command === 'pt_img') {
      await menu.prompt(chatId, await this.convoService.wholeConvo(chatId), 'Envia o título da capa numa mensagem de texto.');
      return;
    }

    if (command !== 'img_add' && command !== 'video')
      throw new BotError(`Only images for the 'img_add' command are handled here.`);

    const buffer = await this.botUtils.loadFile(bot, msg.image.file);

    if (command === 'img_add')
      await this.imgAddHandlePhoto(msg, menu, buffer);
    if (command === 'video')
      await this.videoHandlePhoto(chatId, reply, buffer);
  }

  isImageCommand(command: string) {
    return command === 'img_add' || command === 'pt_img';
  }

  async handleText(msg: messageText, menu: BotMenu): Promise<void> {
    const chatId = msg.chat.id;
    const command = await this.convoService.getCommand(chatId);
    if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle text');

    if (command === 'pt_img') {
      const title = msg.text.trim();
      if (!title) throw new BotError('Escreve o título que queres pôr na capa do vídeo.');
      await this.sendThumbnail(chatId, title);
      await this.convoService.delete(chatId);
    } else if (command === 'img_add') {
      const res = await this.convoService.setImgName(chatId, msg.text);
      if (!res) throw new BotError(`Coudn't set the image name`);

      const data = await this.convoService.getAddImageData(chatId);
      if (data && data.image && data.name)
        await this.addImageToDb(msg, menu);
      else await menu.prompt(chatId, await this.convoService.wholeConvo(chatId), 'Identificador recebido. Agora envia a foto.');
    }
  }

  private async addImageToDb(msg: Message, menu: BotMenu) {
    const data = await this.convoService.getAddImageData(msg.chat.id);
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
    await this.listsService.ensureEditor(msg, true);
    await this.imageService.save(dto);
    await this.botUtils.deleteUserData(msg.chat.id);
    await menu.send(msg.chat.id, 'Imagem guardada.', [ [ menuButton('Voltar ao menu', 'menu') ] ]);
  }

}
