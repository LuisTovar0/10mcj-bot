import type { PrivateChatUpdate } from "../../telegram-bot/telegram-user-id";
import { Bot } from "../../telegram-bot/types/botgram";

export default interface IListsService {

  registerCommands(bot: Bot): void;

  admission(userId: number): Promise<'allowed' | 'blocked' | 'development'>;

  isAdmin(msg: PrivateChatUpdate): boolean;

  canEdit(msg: PrivateChatUpdate): Promise<boolean>;

  ensureEditor(msg: PrivateChatUpdate, activeWorkflow?: boolean): Promise<void>;

}
