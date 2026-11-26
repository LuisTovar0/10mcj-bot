import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import moment from "moment";
import { Inject, Service } from "typedi";
import config from "../../../config";
import { filesFolder } from "../../../config/constants";
import UniqueEntityID from "../../../domain/core/unique-entity-id";
import type { ThumbnailBackground } from "../../../domain/simple-user";
import ImageDto from "../../../dto/image.dto";
import type AiThumbnailService from "../../ai-thumbnail.service";
import type { ThumbnailState } from "../../i-service/i-ai-thumbnail.provider";
import IImageCommandsService from "../../i-service/i-image-commands.service";
import IImageEditingService from "../../i-service/i-image-editing.service";
import IImageService from "../../i-service/i-image.service";
import ISimpleUserService from "../../i-service/i-simpleUser.service";
import IBotUtilsService from "../../i-service/telegram-bot/i-bot-utils.service";
import IConvoMemoryService, {
  type Convo, ConvoError, type ThumbnailDraft,
} from "../../i-service/telegram-bot/i-convo-memory.service";
import IListsService from "../../i-service/telegram-bot/i-lists-service";
import BotError from "../bot-error";
import { type BotMenu, menuButton, type RegisterMenuAction, startWorkflow } from "../bot-menu";
import type { PrivateChatUpdate } from "../telegram-user-id";
import * as textFormatting from "../text-formatting.service";
import { Bot, Message, ReplyQueue } from "../types/botgram";
import { messagePhoto, messageText } from "../types/model";

type ThumbnailCommand = 'pt_img' | 'pt_img_ai';
type ThumbnailWorkflow = Convo & { command: ThumbnailCommand; data: { thumbnail: ThumbnailDraft } };

const draftDateFormat = 'YYYY-MM-DD';
const inputDateFormat = 'DD/MM/YYYY';
const bundledBackground: ThumbnailBackground = { kind: 'built-in' };
const draftPrompts = {
  title: 'Envia o título que queres pôr na capa do vídeo.',
  date: 'Envia a nova data no formato DD/MM/AAAA.',
  background: 'Envia uma foto para o fundo da capa ou escreve um identificador válido da galeria.',
};
const unavailableBackground = 'A imagem de fundo não está disponível.';
const aiRetry = 'Não consegui criar a capa com IA. Tenta novamente daqui a pouco.';

function isThumbnailWorkflow(convo: Convo | null): convo is ThumbnailWorkflow {
  return !!convo && (convo.command === 'pt_img' || convo.command === 'pt_img_ai') && 'thumbnail' in convo.data;
}

function backgroundLabel(source: ThumbnailBackground): string {
  switch (source.kind) {
    case 'built-in': return 'Imagem incluída (rapaz.jpg)';
    case 'gallery': return `Galeria (${ source.id })`;
    case 'telegram': return 'Foto enviada no Telegram';
  }
}

function photoHash(photo: Buffer): string {
  return createHash('sha256').update(photo).digest('hex');
}

function displayDate(date: string): string {
  return moment.utc(date, draftDateFormat, true).locale('pt-pt').format('DD MMMM YYYY');
}

@Service()
export default class ImageCommands implements IImageCommandsService {

  private readonly backgroundWrites = new Map<number, Promise<void>>();

  constructor(
      @Inject(config.deps.service.lists.name) private listsService: IListsService,
      @Inject(config.deps.service.convoMemory.name) private convoService: IConvoMemoryService,
      @Inject(config.deps.service.imageEditing.name) private imageEditingService: IImageEditingService,
      @Inject(config.deps.service.image.name) private imageService: IImageService,
      @Inject(config.deps.service.botUtils.name) private botUtils: IBotUtilsService,
      @Inject(config.deps.service.simpleUser.name) private simpleUserService: ISimpleUserService,
      @Inject(config.deps.service.aiThumbnails.name) private aiThumbnails: Pick<AiThumbnailService, 'state' | 'start'>,
  ) {}

  registerCommands(bot: Bot, menu: BotMenu, registerMenuAction: RegisterMenuAction): void {
    registerMenuAction('images', async msg => {
      const canEdit = await this.listsService.canEdit(msg);
      const rows = [ [ menuButton('Criar capa para YouTube', 'pt_img') ] ];
      if (canEdit) {
        if (this.aiThumbnails.state === 'enabled') rows.push([ menuButton('Criar capa com IA', 'pt_img_ai') ]);
        rows.push([ menuButton('Adicionar imagem à galeria', 'img_add') ]);
      }
      rows.push([ menuButton('Voltar ao menu', 'menu') ]);
      await menu.send(msg.chat.id, 'Imagens para as capas dos vídeos.', rows);
    });

    registerMenuAction('img_add', async msg => {
      await this.listsService.ensureEditor(msg);
      await startWorkflow(this.convoService, menu, msg.chat.id, { command: 'img_add', data: {} },
          'Envia a foto e o identificador que queres dar-lhe em duas mensagens.');
    });

    for (const command of [ 'pt_img', 'pt_img_ai' ] as const) {
      registerMenuAction(command, msg => this.startThumbnail(bot, menu, msg, command), false);
      bot.command(command, msg => this.startThumbnail(bot, menu, msg, command, msg.args().trim()));
    }

    registerMenuAction('thumbnail_create', msg => this.confirmThumbnail(bot, menu, msg), false);
    for (const field of [ 'title', 'date', 'background' ] as const) {
      registerMenuAction(`thumbnail_${ field }`, async msg => {
        const workflow = await this.activeThumbnail(msg);
        if (workflow?.data.thumbnail.step !== 'review') return;
        await this.promptForDraftField(menu, msg.chat.id, workflow, field);
      }, false);
    }
    registerMenuAction('thumbnail_date_back', async msg => {
      const workflow = await this.activeThumbnail(msg);
      if (workflow?.data.thumbnail.step === 'date') await this.showReview(bot, menu, msg.chat.id, workflow);
    }, false);

    bot.command('img_choose', async (msg, reply) => {
      const workflow = await this.activeThumbnail(msg);
      if (!workflow) {
        reply.text('Começa uma capa com /pt_img ou /pt_img_ai para escolheres uma imagem de fundo.');
        return;
      }
      await this.changeBackground(bot, menu, msg.chat.id, workflow, { kind: 'gallery', id: msg.args().trim() });
    });

    bot.command('chosen_img', async (msg, reply) => {
      const background = await this.defaultBackground(bot, msg.chat.id);
      reply.text(background ? `Fundo para a próxima capa: ${ backgroundLabel(background.source) }` : unavailableBackground);
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

  private async startThumbnail(bot: Bot, menu: BotMenu, msg: PrivateChatUpdate, command: ThumbnailCommand,
                               args = ''): Promise<void> {
    const chatId = msg.chat.id;
    const current = await this.convoService.wholeConvo(chatId);
    const active = isThumbnailWorkflow(current) && current.command === command;
    if (command === 'pt_img_ai') {
      await this.listsService.ensureEditor(msg, active);
      const unavailable = this.aiUnavailableMessage(this.aiThumbnails.state);
      if (unavailable) throw new BotError(unavailable);
    }

    const prefix = command === 'pt_img' ? /^\((\S*?)\)(?:\s+|$)/.exec(args) : null;
    const offset = Number(prefix?.[1]);
    const alignment = Number.isNaN(offset) ? undefined : offset;
    const title = prefix && alignment !== undefined ? args.slice(prefix[0].length) : args;
    if (active) {
      const draft = current.data.thumbnail;
      if (alignment !== undefined) draft.alignment = alignment;
      if (title) draft.title = title;
      if (title && draft.step !== 'background') await this.showReview(bot, menu, chatId, current);
      else await this.showDraftStep(bot, menu, chatId, current);
      return;
    }

    const { day, month, year } = textFormatting.theDate();
    const date = moment.utc([ year, month - 1, day ]).format(draftDateFormat);
    const workflow: ThumbnailWorkflow = {
      command,
      data: { thumbnail: { title: title || undefined, date, alignment, step: title ? 'review' : 'title' } },
    };
    await startWorkflow(this.convoService, menu, chatId, workflow,
        () => this.showDraftStep(bot, menu, chatId, workflow));
  }

  private async activeThumbnail(msg: PrivateChatUpdate): Promise<ThumbnailWorkflow | undefined> {
    const workflow = await this.convoService.wholeConvo(msg.chat.id);
    if (!isThumbnailWorkflow(workflow)) return;
    if (workflow.command === 'pt_img_ai') await this.listsService.ensureEditor(msg, true);
    return workflow;
  }

  private async showDraftStep(bot: Bot, menu: BotMenu, chatId: number, workflow: ThumbnailWorkflow): Promise<void> {
    const { step } = workflow.data.thumbnail;
    if (step === 'review') await this.showReview(bot, menu, chatId, workflow);
    else await this.promptForDraftField(menu, chatId, workflow, step);
  }

  private async promptForDraftField(menu: BotMenu, chatId: number, workflow: ThumbnailWorkflow,
                                    field: keyof typeof draftPrompts, notice?: string): Promise<void> {
    const prompt = notice ? `${ notice } ${ draftPrompts[field] }` : draftPrompts[field];
    workflow.data.thumbnail.step = field;
    if (field === 'date') {
      const current = moment.utc(workflow.data.thumbnail.date, draftDateFormat, true).format(inputDateFormat);
      await menu.send(chatId, `${ prompt }\nData atual: ${ current }`, [
        [ menuButton('Voltar à revisão', 'thumbnail_date_back'), menuButton('Cancelar tarefa', 'cancel') ],
      ], workflow);
      return;
    }
    await menu.prompt(chatId, workflow, prompt);
  }

  private async loadBackground(bot: Bot, background: ThumbnailBackground): Promise<Buffer | undefined> {
    switch (background.kind) {
      case 'built-in':
        return readFile(`${ filesFolder }/rapaz.jpg`).catch(() => undefined);
      case 'gallery':
        return background.id ? (await this.imageService.getById(background.id))?.file.file : undefined;
      case 'telegram':
        return background.id ? this.botUtils.loadFile(bot, background.id).catch(() => undefined) : undefined;
    }
  }

  private async defaultBackground(bot: Bot, chatId: number) {
    await this.backgroundWrites.get(chatId);
    const { lastThumbnailBackground, chosenPhotoId } = await this.simpleUserService.getUserById(chatId);
    const legacy: ThumbnailBackground | undefined = chosenPhotoId ? { kind: 'gallery', id: chosenPhotoId } : undefined;
    for (const source of [ lastThumbnailBackground, legacy, bundledBackground ]) {
      if (!source) continue;
      const photo = await this.loadBackground(bot, source);
      if (photo?.length) return { source, photo };
    }
  }

  private async showReview(bot: Bot, menu: BotMenu, chatId: number, workflow: ThumbnailWorkflow,
                           photo?: Buffer, notice?: string): Promise<void> {
    const draft = workflow.data.thumbnail;
    if (!draft.title) {
      await this.promptForDraftField(menu, chatId, workflow, 'title');
      return;
    }

    if (draft.background) {
      photo ??= await this.loadBackground(bot, draft.background);
    } else {
      const resolved = await this.defaultBackground(bot, chatId);
      draft.background = resolved?.source;
      photo = resolved?.photo;
    }
    if (!photo?.length || !draft.background) {
      await this.promptForDraftField(menu, chatId, workflow, 'background', unavailableBackground);
      return;
    }

    const summary = [
      notice, `Título: ${ draft.title }`, `Data: ${ displayDate(draft.date) }`, `Fundo: ${ backgroundLabel(draft.background) }`,
    ].filter(Boolean).join('\n');
    await menu.sendPhoto(chatId, photo, summary, [
      [ menuButton('CRIAR IMAGEM', 'thumbnail_create') ],
      [ menuButton('Alterar título', 'thumbnail_title'), menuButton('Alterar data', 'thumbnail_date') ],
      [ menuButton('Alterar imagem', 'thumbnail_background'), menuButton('Cancelar', 'cancel') ],
    ], workflow);
    draft.reviewedPhotoHash = photoHash(photo);
    draft.step = 'review';
  }

  private async changeBackground(bot: Bot, menu: BotMenu, chatId: number, workflow: ThumbnailWorkflow,
                                 source: ThumbnailBackground): Promise<void> {
    const photo = await this.loadBackground(bot, source);
    if (!photo?.length) {
      await this.promptForDraftField(menu, chatId, workflow, 'background', unavailableBackground);
      return;
    }
    workflow.data.thumbnail.background = source;
    await this.showReview(bot, menu, chatId, workflow, photo);
  }

  private async confirmThumbnail(bot: Bot, menu: BotMenu, msg: PrivateChatUpdate): Promise<void> {
    const chatId = msg.chat.id;
    const workflow = await this.activeThumbnail(msg);
    if (!workflow) return;
    const { step, title, background, alignment, reviewedPhotoHash } = workflow.data.thumbnail;
    if (step !== 'review' || !title || !background) return;

    const photo = await this.loadBackground(bot, background);
    if (workflow.command === 'pt_img_ai') await this.listsService.ensureEditor(msg, true);
    if (!photo?.length) {
      await this.promptForDraftField(menu, chatId, workflow, 'background', unavailableBackground);
      return;
    }
    if (photoHash(photo) !== reviewedPhotoHash) {
      await this.showReview(bot, menu, chatId, workflow, photo, 'A imagem de fundo mudou. Revê a nova imagem.');
      return;
    }

    const date = displayDate(workflow.data.thumbnail.date);
    if (workflow.command === 'pt_img_ai') {
      const unavailable = this.aiUnavailableMessage(this.aiThumbnails.state);
      if (unavailable) {
        await this.showReview(bot, menu, chatId, workflow, photo, unavailable);
        return;
      }
      const job = this.aiThumbnails.start({
        title, date,
        acknowledge: () => this.botUtils.sendMessage(chatId, 'Vou criar a capa com IA.'),
        background: async () => photo,
      });
      if (job.status !== 'started') {
        const notice = job.status === 'busy'
            ? 'Já está a ser criada uma capa com IA. Tenta novamente daqui a pouco.'
            : this.aiUnavailableMessage(job.status);
        await this.showReview(bot, menu, chatId, workflow, photo, notice);
        return;
      }

      // The chat can prepare another draft while the provider works.
      void job.result.then(async result => {
        if (result.status === 'failed') await this.botUtils.sendMessage(chatId, aiRetry);
        else await this.deliverThumbnail(chatId, result.png, background,
            result.quality === 'below-target' ? 'A melhor capa gerada ficou abaixo do objetivo de qualidade.' : undefined);
      }).catch(async () => {
        console.warn('[thumbnail-ai] failure=delivery');
        await this.botUtils.sendMessage(chatId, 'Não consegui enviar a capa com IA. Tenta novamente daqui a pouco.');
      }).catch(() => { console.warn('[thumbnail-ai] failure=notification'); });
    } else {
      try {
        const thumbnail = await this.imageEditingService.generate(photo, date, title, { imgAlign: alignment });
        await this.deliverThumbnail(chatId, thumbnail, background);
      } catch {
        await this.showReview(bot, menu, chatId, workflow, photo,
            'Não consegui criar ou enviar a capa. Podes tentar novamente.');
        return;
      }
    }
    await this.convoService.delete(chatId);
  }

  private async deliverThumbnail(chatId: number, thumbnail: Buffer, background: ThumbnailBackground,
                                 caption?: string): Promise<void> {
    const form = new FormData();
    form.set('photo', new Blob([ new Uint8Array(thumbnail) ], { type: 'image/png' }), 'capa.png');
    form.set('chat_id', String(chatId));
    if (caption) form.set('caption', caption);
    await this.botUtils.apiMethod('sendPhoto', form);

    // Queue writes after Telegram accepts each photo so a slow write cannot overwrite a newer delivery.
    const pending = (this.backgroundWrites.get(chatId) ?? Promise.resolve())
        .then(() => this.simpleUserService.setLastThumbnailBackground(chatId, background))
        .catch(() => { console.warn('[thumbnail] failure=save-background'); });
    this.backgroundWrites.set(chatId, pending);
    try {
      await pending;
    } finally {
      if (this.backgroundWrites.get(chatId) === pending) this.backgroundWrites.delete(chatId);
    }
  }

  private aiUnavailableMessage(state: ThumbnailState): string | undefined {
    switch (state) {
      case 'misconfigured': return 'A criação de capas com IA tem um erro de configuração.';
      case 'api-key-unsupported': return 'Esta versão do Codex precisa de uma sessão ChatGPT para criar capas com IA.';
      case 'disabled': return 'A criação de capas com IA está indisponível.';
    }
  }

  private async handleThumbnailInput(bot: Bot, menu: BotMenu, msg: PrivateChatUpdate,
                                     input: { text?: string; photoId?: string } = {}): Promise<boolean> {
    const workflow = await this.activeThumbnail(msg);
    if (!workflow) return false;
    const chatId = msg.chat.id;
    const draft = workflow.data.thumbnail;
    switch (draft.step) {
      case 'title':
        if (input.text) {
          draft.title = input.text;
          await this.showReview(bot, menu, chatId, workflow);
        } else await this.promptForDraftField(menu, chatId, workflow, 'title');
        break;
      case 'date': {
        const date = moment.utc(input.text ?? '', inputDateFormat, true);
        if (date.isValid() && date.year() > 0) {
          draft.date = date.format(draftDateFormat);
          await this.showReview(bot, menu, chatId, workflow);
        } else await this.promptForDraftField(menu, chatId, workflow, 'date', 'Data inválida.');
        break;
      }
      case 'background':
        if (input.photoId) {
          await this.changeBackground(bot, menu, chatId, workflow, { kind: 'telegram', id: input.photoId });
        } else if (input.text) {
          await this.changeBackground(bot, menu, chatId, workflow, { kind: 'gallery', id: input.text });
        } else await this.promptForDraftField(menu, chatId, workflow, 'background');
        break;
      case 'review':
        bot.reply(chatId).text('Usa os botões da revisão para alterar a capa ou criar a imagem.');
        break;
    }
    return true;
  }

  handleOtherInput(bot: Bot, msg: PrivateChatUpdate, menu: BotMenu): Promise<boolean> {
    return this.handleThumbnailInput(bot, menu, msg);
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
    if (await this.handleThumbnailInput(bot, menu, msg, { photoId: msg.image.file.id })) return;
    const chatId = msg.chat.id;
    const command = await this.convoService.getCommand(chatId);
    if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle photo');

    if (command !== 'img_add' && command !== 'video')
      throw new BotError(`Only images for the 'img_add' command are handled here.`);

    const buffer = await this.botUtils.loadFile(bot, msg.image.file);

    if (command === 'img_add')
      await this.imgAddHandlePhoto(msg, menu, buffer);
    if (command === 'video')
      await this.videoHandlePhoto(chatId, reply, buffer);
  }

  isImageCommand(command: string) {
    return command === 'img_add' || command === 'pt_img' || command === 'pt_img_ai';
  }

  async handleText(bot: Bot, msg: messageText, menu: BotMenu): Promise<void> {
    if (await this.handleThumbnailInput(bot, menu, msg, { text: msg.text.trim() })) return;
    const chatId = msg.chat.id;
    const command = await this.convoService.getCommand(chatId);
    if (command === null) throw await ConvoError.new(this.convoService, chatId, 'getCommand at handle text');

    if (command === 'img_add') {
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
