import {Service} from "typedi";

import IConvoMemoryService from "../iService/iConvoMemory.service";
import {Convo, ConvoMemory, InfosForText} from "../../bot/types";

@Service()
export default class LocalConvoMemoryService implements IConvoMemoryService {

  private memory: ConvoMemory = {};

  async delete(chatId: number): Promise<void> {
    delete this.memory[chatId];
  }

  async exists(chatId: number): Promise<boolean> {
    return !!this.memory[chatId];
  }

  async getCommand(chatId: number): Promise<string | undefined> {
    return this.memory[chatId]?.command;
  }

  async getText(chatId: number): Promise<InfosForText | undefined> {
    return this.memory[chatId]?.data.text;
  }

  async hasAudio(chatId: number): Promise<boolean | undefined> {
    return this.memory[chatId]?.data.audio;
  }

  async set(chatId: number, v: Convo): Promise<void> {
    this.memory[chatId] = v;
  }

  async setAudio(chatId: number, audio: boolean): Promise<void> {
    this.memory[chatId].data.audio = audio;
  }

  async setText(chatId: number, text: InfosForText): Promise<void> {
    this.memory[chatId].data.text = text;
  }

  async wholeConvo(chatId: number): Promise<Convo | undefined> {
    return this.memory[chatId];
  }

}
