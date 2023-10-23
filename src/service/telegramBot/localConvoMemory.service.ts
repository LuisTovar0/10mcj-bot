import {Service} from "typedi";
import IConvoMemoryService, {
  AddImageData, Convo, Data, InfosForText, isAddImageData, isTextData, isVideoData, TextData, VideoData,
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

  /**
   * If chat isn't being recorded, returns null.<br/>
   * If data isn't present, returns undefined.
   */
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

  //#region add image data
  async getAddImageData(chatId: number): Promise<AddImageData | null | undefined> {
    const data = await this.getData(chatId);
    if (!data) return data;
    if (!isAddImageData(data)) return undefined;
    return data;
  }

  async setImg(chatId: number, img: Buffer): Promise<boolean> {
    const data = await this.getAddImageData(chatId);
    if (!data) return false;
    (this.memory[chatId].data as AddImageData).image = img;
    return true;
  }

  async setImgName(chatId: number, name: string): Promise<boolean> {
    const data = await this.getAddImageData(chatId);
    if (!data) return false;
    (this.memory[chatId].data as AddImageData).name = name;
    return true;
  }

  //#endregion

  //#region video
  async getVideoData(chatId: number) {
    const data = await this.getData(chatId);
    if (!data) return data;
    if (!isVideoData(data)) return undefined;
    return data;
  }

  async videoHasAudio(chatId: number): Promise<boolean | null | undefined> {
    const data = await this.getData(chatId);
    if (!data) return data;
    if (!isVideoData(data)) return undefined;
    return data.audio;
  }

  async getVideoImage(chatId: number): Promise<Buffer | null | undefined> {
    const data = await this.getData(chatId);
    if (!data) return data;
    if (!isVideoData(data)) return undefined;
    return data.image;
  }

  async getVideoText(chatId: number): Promise<string | null | undefined> {
    const data = await this.getData(chatId);
    if (!data) return data;
    if (!isVideoData(data)) return undefined;
    return data.text;
  }

  async setVideoAudio(chatId: number, audio: boolean): Promise<boolean> {
    const data = await this.getVideoData(chatId);
    if (!data) return false;
    (this.memory[chatId].data as VideoData).audio = audio;
    return true;
  }

  async setVideoImage(chatId: number, imgBuffer: Buffer): Promise<boolean> {
    const data = await this.getVideoData(chatId);
    if (!data) return false;
    (this.memory[chatId].data as VideoData).image = imgBuffer;
    return true;
  }

  async setVideoText(chatId: number, text: string): Promise<boolean> {
    const data = await this.getVideoData(chatId);
    if (!data) return false;
    (this.memory[chatId].data as VideoData).text = text;
    return true;
  }

  //#endregion

}
