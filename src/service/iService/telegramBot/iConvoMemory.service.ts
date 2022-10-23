import {Convo, InfosForText} from "../../telegramBot/types";

export default interface IConvoMemoryService {

  exists(chatId: number): Promise<boolean>;

  getCommand(chatId: number): Promise<string | undefined>;

  hasAudio(chatId: number): Promise<boolean | undefined>;

  getText(chatId: number): Promise<undefined | InfosForText>;

  wholeConvo(chatId: number): Promise<undefined | Convo>;

  setAudio(chatId: number, audio: boolean): Promise<void>;

  setText(chatId: number, text: InfosForText): Promise<void>;

  set(chatId: number, v: Convo): Promise<void>;

  delete(chatId: number): Promise<void>;

}