import type IConvoMemoryService from "../i-service/telegram-bot/i-convo-memory.service";
import type { Convo } from "../i-service/telegram-bot/i-convo-memory.service";
import type { PrivateChatUpdate } from "./telegram-user-id";
import type { Bot } from "./types/botgram";
import type { InlineKeyboardButton, Message } from "./types/model";

type MenuAction = 'menu' | 'info' | 'pt_testar' | 'pt_enviar' | 'pt_img' | 'pt_img_ai' | 'images' | 'img_add'
    | 'cancel' | 'thumbnail_create' | 'thumbnail_title' | 'thumbnail_date' | 'thumbnail_background'
    | 'thumbnail_date_back';
type MenuButton = InlineKeyboardButton & { callback_data: string };
export type MenuHandler = (update: PrivateChatUpdate) => Promise<void>;
export type RegisterMenuAction = (action: MenuAction, handler: MenuHandler, slashCommand?: boolean) => void;

export const menuPrefix = 'menu:';

interface ActiveKeyboard {
  messageId: number;
  actions: Set<string>;
  workflow?: Convo;
}

export function menuButton(text: string, action: MenuAction): MenuButton {
  return { text, callback_data: `${ menuPrefix }${ action }` };
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
    // Botgram forwards these options to the multipart encoder so Telegram receives a named file.
    const upload = Object.assign(Buffer.from(photo), { options: { filename: 'fundo' } });
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

  private setKeyboard(chatId: number, messageId: number, rows: MenuButton[][], workflow?: Convo): void {
    this.retire(chatId);
    this.keyboards.set(chatId, {
      messageId,
      actions: new Set(rows.flat().map(button => button.callback_data)),
      workflow,
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
    this.retire(chatId);
    return true;
  }

  async retireEndedWorkflow(chatId: number, convos: IConvoMemoryService): Promise<void> {
    const workflow = this.keyboards.get(chatId)?.workflow;
    // LocalConvoMemoryService keeps the same object until the workflow ends.
    if (workflow && workflow !== await convos.wholeConvo(chatId)) this.retire(chatId);
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
