export default interface IConvoMemoryService {

  exists(chatId: number): Promise<boolean>;

  /**
   * If the chat is not recorded, returns null.
   */
  getCommand(chatId: number): Promise<string | null>;

  /**
   * If the chat is not recorded, returns null.
   */
  wholeConvo(chatId: number): Promise<Convo | null>;

  // /**
  //  * If the chat is not recorded, returns null.<br/>
  //  * Otherwise, if the data isn't defined returns undefined.
  //  */
  // getData(chatId: number): Promise<Data | undefined | null>;

  set(chatId: number, v: Convo): Promise<void>;

  /**
   * If the chat is not recorded, returns false; otherwise, true.
   */
  setData(chatId: number, d: Data): Promise<boolean>;

  delete(chatId: number): Promise<void>;

  //#region text data
  /**
   * If chat isn't being recorded, returns null.<br/>
   * If data isn't present, or if it isn't TextData, returns undefined.
   */
  hasAudio(chatId: number): Promise<boolean | undefined | null>;

  /**
   * If chat isn't being recorded, returns null.<br/>
   * If data isn't present, or if it isn't TextData, returns undefined.
   */
  getText(chatId: number): Promise<InfosForText | undefined | null>;

  setAudio(chatId: number, audio: boolean): Promise<boolean>;

  setText(chatId: number, text: InfosForText): Promise<boolean>;

  //#endregion

}

export interface InfosForText {
  telegram: string;
  signal: string,
  date: string;
  descr1: string;
  descr2?: string;
}

export function isInfosForText(v: any): v is InfosForText {
  if (!v) return false;
  const ift = v as InfosForText;

  function isString(a: any) {
    return typeof a === 'string';
  }

  const td2 = typeof ift.descr2;
  return isString(ift.telegram) && isString(ift.signal) && isString(ift.date) && isString(ift.descr1)
    && (td2 === 'string' || td2 === 'undefined');
}

export class ImageData {
}

export interface TextData {
  audio: boolean;
  text?: InfosForText;
}

export function isTextData(v: any): v is TextData {
  if (!v) return false;
  const td = v as TextData;
  // noinspection SuspiciousTypeOfGuard
  return (typeof td.audio) === 'boolean' && (td.text === undefined || isInfosForText(td.text));
}

export type Data = TextData | ImageData;

export interface Convo {
  command: string;
  data?: Data;
}

export class ConvoError extends Error {
  private constructor(msg?: string) {
    super(msg || 'An incoherence has occurred in the conversation. ' +
      'Please start over. Please report to @tovawr if this error keeps occurring.');
    this.name = 'ConvoError';
  }

  static async new(convoService: IConvoMemoryService, chatId: number, msg?: string) {
    await convoService.delete(chatId);
    return new ConvoError(msg);
  }
}
