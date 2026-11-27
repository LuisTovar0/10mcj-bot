import type IConvoMemoryService from "../i-service/telegram-bot/i-convo-memory.service";
import type { Convo } from "../i-service/telegram-bot/i-convo-memory.service";
import type { PrivateChatUpdate } from "./telegram-user-id";
import type { Bot } from "./types/botgram";
import type { InlineKeyboardButton, Message } from "./types/model";

type MenuAction = 'menu' | 'info' | 'pt_testar' | 'pt_enviar' | 'pt_img' | 'pt_img_ai' | 'images' | 'img_add'
    | 'cancel' | 'thumbnail_create' | 'thumbnail_title' | 'thumbnail_date' | 'thumbnail_background'
    | 'thumbnail_date_back' | 'thumbnail_color_back' | 'thumbnail_layout' | 'thumbnail_template'
    | 'thumbnail_color' | 'thumbnail_blue' | 'thumbnail_yellow' | 'thumbnail_prev' | 'thumbnail_next';
type MenuButton = InlineKeyboardButton & { callback_data: string };
export type MenuHandler = (update: PrivateChatUpdate) => Promise<void>;
export type RegisterMenuAction = (action: MenuAction, handler: MenuHandler, slashCommand?: boolean) => void;

export const menuPrefix = 'menu:';

interface ActiveKeyboard {
  messageId: number;
  actions: Set<string>;
  workflow?: Convo;
  revision?: number;
  photoHash?: string;
}

export function menuButton(text: string, action: MenuAction): MenuButton {
  return { text, callback_data: `${ menuPrefix }${ action }` };
}

function photoUpload(photo: Buffer) {
  // Botgram forwards these options to its multipart encoder.
  return Object.assign(Buffer.from(photo), { options: { filename: 'fundo' } });
}

export class BotMenu {
  private readonly keyboards = new Map<number, ActiveKeyboard>();

  constructor(private readonly bot: Bot) {}

  async send(chatId: number, text: string, rows: MenuButton[][], workflow?: Convo): Promise<void> {
    const message: Message = await this.bot.reply(chatId).inlineKeyboard(rows).text(text).then();
    this.setKeyboard(chatId, message.id, rows, workflow);
  }

  async sendPhoto(chatId: number, photo: Buffer, caption: string, rows: MenuButton[][],
                  workflow: Convo): Promise<void> {
    const upload = photoUpload(photo);
    if (caption.length > 1024) {
      await this.bot.reply(chatId).photo(upload).then();
      // Telegram allows more text in messages than in photo captions.
      const parts = caption.match(/[\s\S]{1,2000}/gu)!;
      for (const part of parts.slice(0, -1)) await this.bot.reply(chatId).text(part).then();
      await this.send(chatId, parts.at(-1)!, rows, workflow);
      return;
    }
    const message: Message = await this.bot.reply(chatId).inlineKeyboard(rows).photo(upload, caption).then();
    this.setKeyboard(chatId, message.id, rows, workflow);
  }

  async updateThumbnailMenu(chatId: number, workflow: Convo, text: string, rows: MenuButton[][],
                            photo?: { bytes: Buffer; hash: string }): Promise<void> {
    const previous = this.keyboards.get(chatId);
    const current = previous?.workflow === workflow && previous.revision ? previous : undefined;
    const revision = (current?.revision ?? 0) + 1;
    const buttons = rows.map(row => row.map(button => ({
      ...button, callback_data: `${ button.callback_data }#${ revision }`,
    })));
    if (current) {
      current.actions.clear();
      const target = { chat_id: chatId, message_id: current.messageId, reply_markup: { inline_keyboard: buttons } };
      let edited: boolean;
      if (photo && photo.hash !== current.photoHash) {
        edited = await this.editMessage('editMessageMedia', {
          ...target, media: { type: 'photo', media: 'attach://background', caption: text }, background: photoUpload(photo.bytes),
        });
      } else if (current.photoHash) {
        edited = await this.editMessage('editMessageCaption', { ...target, caption: text });
      } else {
        edited = await this.editMessage('editMessageText', { ...target, text });
      }
      if (edited) {
        this.setKeyboard(chatId, current.messageId, buttons, workflow, revision, photo?.hash ?? current.photoHash);
        return;
      }
    }

    const reply = this.bot.reply(chatId).inlineKeyboard(buttons);
    const sent: Message = await (photo ? reply.photo(photoUpload(photo.bytes), text) : reply.text(text)).then();
    this.setKeyboard(chatId, sent.id, buttons, workflow, revision, photo?.hash);
  }

  private editMessage(method: string, parameters: object): Promise<boolean> {
    return new Promise((resolve, reject) => this.bot.callMethod(method, parameters, error => {
      if (!error) return resolve(true);
      if (error instanceof Error && /message is not modified/i.test(error.message)) return resolve(true);
      if (error instanceof Error && /message to edit not found|message can't be edited/i.test(error.message)) return resolve(false);
      reject(error);
    }));
  }

  private setKeyboard(chatId: number, messageId: number, rows: MenuButton[][], workflow?: Convo,
                      revision?: number, photoHash?: string): void {
    if (this.keyboards.get(chatId)?.messageId !== messageId) this.retire(chatId);
    this.keyboards.set(chatId, {
      messageId,
      actions: new Set(rows.flat().map(button => button.callback_data)),
      workflow, revision, photoHash,
    });
  }

  async prompt(chatId: number, workflow: Convo | null, text: string): Promise<void> {
    if (workflow) await this.send(chatId, text, [ [ menuButton('Cancelar tarefa', 'cancel') ] ], workflow);
    else this.bot.reply(chatId).text(text);
  }

  consume(chatId: number, messageId: number, action: string): boolean {
    const current = this.keyboards.get(chatId);
    if (current?.messageId !== messageId) {
      this.removeButtons(chatId, messageId);
      return false;
    }
    if (!current.actions.has(action)) return false;
    // An editable menu replaces its markup in the next API call. Clearing it remotely here can race that edit.
    if (current.revision) current.actions.clear();
    else this.retire(chatId);
    return true;
  }

  async retireEndedWorkflow(chatId: number, convos: IConvoMemoryService): Promise<void> {
    const current = this.keyboards.get(chatId);
    // LocalConvoMemoryService keeps the same object until the workflow ends.
    if (current?.workflow && (!current.actions.size || current.workflow !== await convos.wholeConvo(chatId)))
      this.retire(chatId);
  }

  private retire(chatId: number): void {
    const current = this.keyboards.get(chatId);
    if (!current) return;
    this.keyboards.delete(chatId);
    this.removeButtons(chatId, current.messageId);
  }

  private removeButtons(chatId: number, messageId: number): void {
    // Keyboard retirement is already enforced locally, even if Telegram rejects the edit.
    this.bot.callMethod('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }, () => {});
  }
}

export async function startWorkflow(convos: IConvoMemoryService, menu: BotMenu, chatId: number, workflow: Convo,
                                    prompt: string | (() => Promise<void>)): Promise<void> {
  const active = await convos.wholeConvo(chatId);
  if (active) {
    await menu.prompt(chatId, active, `Já tens uma tarefa em curso (/${ active.command }). Termina-a ou cancela-a antes de começar outra.`);
    return;
  }

  // The chat queue holds follow-up updates until both steps finish.
  if (typeof prompt === 'string') await menu.prompt(chatId, workflow, prompt);
  else await prompt();
  await convos.set(chatId, workflow);
}
