import {NumberOfRequestsByUser} from "../iInRequest.service";

export interface TextInfo {
  url: string;
  descr1: string;
  descr2?: string;
}

export interface AllInfo extends TextInfo {
  date: string;
}

export interface MessagesAndInfo extends AllInfo {
  telegram: string;
  signal: string;
}

export default interface ITextFormattingService {

  inRequestsToString(reqs: NumberOfRequestsByUser): string;

  /**
   * The day of the meditation.
   */
  theDate(): { day: number; month: number; year: number; };

  /**
   * The day of the meditation in dd-mm-yy string format.
   */
  getDateStr(): string;

  /**
   * Validates the message and returns the contents.
   *
   * May throw BotError.
   */
  analyseMsgPT(text: string): TextInfo;

  /**
   * Generate the Telegram and Signal messages from the complete info.
   * @param info
   */
  telegramSignalPT(info: AllInfo): { telegram: string, signal: string; };

  getFullInfo(text: string): MessagesAndInfo;

}