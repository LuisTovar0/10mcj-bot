export default (text) => {
  let split = text.split('\n');
  if (split.length < 3) throw new Error('bad message: should have 3 paragraphs');

  let url = split[0].trim(), desc = split[2].replace('*', '').replace('*', '').trim(),
    date = new Date(), day = date.getDay(), month = date.getMonth() + 1;
  if (date.getHours() > 14) {
    let tomorrow = new Date();
    tomorrow.setDate(date.getDate() + 1);
    day = tomorrow.getDate();
  }

  const telegramStr = day + '-' + (month < 10 ? '0' : '') + month + '-' + date.getFullYear().toString().substring(2, 4) +
    '\n\n*' + desc + '*\n\n[\u{25B6} YouTube](' + url + ')          [\u{1F310} +Info](https://10minutoscomjesus.org/)';
  // const signalStr = day + '-' + (month < 10 ? '0' : '') + month + '-' + date.getFullYear().toString().substring(2, 4);

  return {telegram: telegramStr, signal: null/*signalStr*/};
}