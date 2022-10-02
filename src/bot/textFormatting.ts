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
    const tomorrow = new Date();
    tomorrow.setDate(date.getDate() + 1);
    day = tomorrow.getDate();
    month = tomorrow.getMonth() + 1;
  }
  const formattedDate = `${day}-${(month < 10 ? `0` : ``) + month}-${date.getFullYear().toString().substring(2, 4)}`;

  const telegramStr = `${formattedDate}\n\n*${descr1}*${descr2 ? `\n_${descr2}_` : ``}\n\n[\u{25B6} YouTube](${url})\
          [\u{1F310} +Info](https://t.me/dezmincomjesus/424)`;
  parseMarkdown(telegramStr); // this is supposed to validate the Markdown, but I think it does nothing
  const signalStr = `${formattedDate}\n\n${descr1}${descr2 ? `\n\n` + descr2 : ``}\n\n\u{25B6} YouTube: ${url}\n\n\u{1F4F2} \
App 10 Minutos com Jesus. Disponível em:\n\u{1F34E} App Store - https://tinyurl.com/10mcj-ios\n\u{1F47E} Google Play - \
https://tinyurl.com/10mcj-android\n\n\u{1F310} +Info: https://10minutoscomjesus.org`;

  return {telegram: telegramStr, signal: signalStr, date: formattedDate, descr: descr1};
}

export function parseMarkdown(txt: string) {
  // copied from https://javascript.plainenglish.io/simple-markdown-parser-with-javascript-and-regular-expressions-f0c8d53449a4
  const htmlText = txt
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
    .replace(/\*(.*)\*/gim, '<i>$1</i>')
    .replace(/!\[(.*?)]\((.*?)\)/gim, "<img alt='$1' src='$2' />")
    .replace(/\[(.*?)]\((.*?)\)/gim, "<a href='$2'>$1</a>")
    .replace(/\n$/gim, '<br />');

  return htmlText.trim();
}
