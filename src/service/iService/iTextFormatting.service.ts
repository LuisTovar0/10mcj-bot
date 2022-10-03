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

  getDate(): string;

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
  telegramSignalPT(info: AllInfo): { telegram: string, signal: string };

  getFullInfo(text: string): MessagesAndInfo;

}