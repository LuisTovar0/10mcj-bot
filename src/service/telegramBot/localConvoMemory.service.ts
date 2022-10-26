import {Service} from "typedi";

import IConvoMemoryService, {
  Convo,
  Data,
  InfosForText,
  isTextData,
  TextData
} from "../iService/telegramBot/iConvoMemory.service";

interface ConvoMemory {
  [k: string]: Convo;
}

@Service()
export default class LocalConvoMemoryService implements IConvoMemoryService {

  private memory: ConvoMemory = {};

  //#region general convo functions
  async delete(chatId: number): Promise<void> {
    delete this.memory[chatId];
  }

  async exists(chatId: number): Promise<boolean> {
    return !!this.memory[chatId];
  }

  async getCommand(chatId: number): Promise<string | null> {
    const convo = await this.wholeConvo(chatId);
    if (!convo) return null;
    return convo.command;
  }

  async wholeConvo(chatId: number): Promise<Convo | null> {
    const convo = this.memory[chatId];
    return convo ? convo : null;
  }

  async getData(chatId: number): Promise<Data | null | undefined> {
    const convo = await this.wholeConvo(chatId);
    if (!convo) return null;
    return convo.data;
  }

  async setData(chatId: number, d: Data) {
    const exists = await this.exists(chatId);
    if (!exists) return false;
    this.memory[chatId].data = d;
    return true;
  }

  async set(chatId: number, v: Convo): Promise<void> {
    this.memory[chatId] = v;
  }

  //#endregion

  //#region text data
  /**
   * If chat isn't being recorded, returns null.<br/>
   * If data isn't present, or if it isn't TextData, returns undefined.
   */
  async getTextData(chatId: number) {
    const data = await this.getData(chatId);
    if (!data) return data;

    if (!isTextData(data))
      return undefined;
    return data;
  }

  async getText(chatId: number) {
    const data = await this.getTextData(chatId);
    if (!data) return data;
    return data.text;
  }

  async hasAudio(chatId: number) {
    const data = await this.getTextData(chatId);
    if (!data) return data;
    return data.audio;
  }

  async setAudio(chatId: number, audio: boolean) {
    const data = await this.getData(chatId);
    if (!isTextData(data)) return false;
    (this.memory[chatId].data as TextData).audio = audio;
    return true;
  }

  async setText(chatId: number, text: InfosForText) {
    const data = await this.getData(chatId);
    if (!isTextData(data)) return false;
    (this.memory[chatId].data as TextData).text = text;
    return true;
  }

  //#endregion

}
