import { Message } from "./types/model";

const maxTelegramUserId = 2 ** 52 - 1;

export function isTelegramUserId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0 && id <= maxTelegramUserId;
}

export function parseTelegramUserId(value: string): number | undefined {
  const decimal = value.trim();
  if (!/^[0-9]+$/.test(decimal)) return undefined;
  const id = Number(decimal);
  return isTelegramUserId(id) ? id : undefined;
}

export function privateSender(msg: Message) {
  if (msg.chat.type === 'user' && msg.from && isTelegramUserId(msg.from.id)) return msg.from;
  return undefined;
}
