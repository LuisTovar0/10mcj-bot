import BotError from "./botError";

export function textFormattingPT(text: string) {
  let split = text.split(`\n`);
  if (split.length < 3)
    throw new BotError(`texto malformado: deve ter pelo menos 3 linhas. por exemplo:
https://youtu.be/dQw4w9WgXcQ\n\n\u{23F9}\u{1F649} *Desliguem o funk que eu não aguento mais*`);

  let url = split[0].trim(),
    descr1 = split[2].replace(`*`, ``).replace(`*`, ``).trim(); // first line of description
  let descr2; // second line of description
  for (let i = 1; i < split.length; i++)
    if (split[i].charAt(0).match(/[_A-Z]/)) {
      descr2 = split[i].replace(`_`, ``).replace(`_`, ``).trim();
      break;
    }

  let date = new Date(), day = date.getDate(), month = date.getMonth() + 1;
  if (date.getHours() > 14) {
    let tomorrow = new Date();
    tomorrow.setDate(date.getDate() + 1);
    day = tomorrow.getDate();
  }
  const formattedDate = `${day}-${(month < 10 ? `0` : ``) + month}-${date.getFullYear().toString().substring(2, 4)}`;

  const telegramStr = `${formattedDate}\n\n*${descr1}*${descr2 ? `\n_${descr2}_` : ``}\n\n[\u{25B6} YouTube](${url})\
          [\u{1F310} +Info](https://t.me/dezmincomjesus/424)`;
  const signalStr = `${formattedDate}\n\n${descr1}${descr2 ? `\n\n` + descr2 : ``}\n\n\u{25B6} YouTube: ${url}\n\n\u{1F4F2} \
App 10 Minutos com Jesus. Disponível em:\n\u{1F34E} App Store - https://tinyurl.com/10mcj-ios\n\u{1F47E} Google Play - \
https://tinyurl.com/10mcj-android\n\n\u{1F310} +Info: https://10minutoscomjesus.org/`;

  return {telegram: telegramStr, signal: signalStr, date: formattedDate, descr: descr1};
}