import { Bot, Message } from "../../telegram-bot/types/botgram";

export default interface IListsService {

  registerCommands(bot: Bot): void;

  admission(userId: number): Promise<'allowed' | 'blocked' | 'development'>;

  isAdmin(msg: Message): boolean;

  canEdit(msg: Message): Promise<boolean>;

  ensureEditor(msg: Message, activeWorkflow?: boolean): Promise<void>;

}
