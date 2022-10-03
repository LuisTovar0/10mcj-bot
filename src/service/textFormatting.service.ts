import {Service} from "typedi";

import ITextFormattingService, {AllInfo} from "./iService/iTextFormatting.service";
import BotError from "../bot/botError";

@Service()
export default class TextFormattingService implements ITextFormattingService {

  getDate() {
    let date = new Date(), day = date.getDate(), month = date.getMonth() + 1;
    if (date.getHours() > 14) {
      const tomorrow = new Date();
      tomorrow.setDate(date.getDate() + 1);
      day = tomorrow.getDate();
      month = tomorrow.getMonth() + 1;
    }
    return `${day}-${(month < 10 ? `0` : ``) + month}-${date.getFullYear().toString().substring(2, 4)}`;
  }

  analyseMsgPT(text: string) {
    let split = text.split(`\n`);
    if (split.length < 3)
      throw new BotError(`texto malformado: deve ter pelo menos 3 linhas. por exemplo:
https://youtu.be/dQw4w9WgXcQ\n\n\u{23F9}\u{1F649} *Desliguem o funk que eu não aguento mais*`);

    let url = split[0].trim(),
      descr1 = split[2].replace(`*`, ``).replace(`*`, ``).trim(); // first line of description
    let descr2: string | undefined; // second line of description
    for (let i = 1; i < split.length; i++)
      if (split[i].charAt(0).match(/[_A-Z]/)) {
        descr2 = split[i].replace(`_`, ``).replace(`_`, ``).trim();
        break;
      }

    return {url, descr1, descr2};
  }

  telegramSignalPT({date, descr1, descr2, url}: AllInfo) {
    const telegram = `${date}\n\n*${descr1}*${descr2 ? `\n_${descr2}_` : ``}\n\n[\u{25B6} YouTube](${url})\
          [\u{1F310} +Info](https://t.me/dezmincomjesus/424)`;
    const signal = `${date}\n\n${descr1}${descr2 ? `\n\n` + descr2 : ``}\n\n\u{25B6} YouTube: ${url}\n\n\u{1F4F2} \
App 10 Minutos com Jesus. Disponível em:\n\u{1F34E} App Store - https://tinyurl.com/10mcj-ios\n\u{1F47E} Google Play - \
https://tinyurl.com/10mcj-android\n\n\u{1F310} +Info: https://10minutoscomjesus.org`;

    return {telegram, signal};
  }

  getFullInfo(text: string) {
    const {url, descr1, descr2} = this.analyseMsgPT(text);
    const date = this.getDate();
    const {telegram, signal} = this.telegramSignalPT({date, url, descr1, descr2});

    return {telegram, signal, url, date, descr1, descr2};
  }

}
