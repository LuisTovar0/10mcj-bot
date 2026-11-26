import { after, afterEach, before, beforeEach, describe, it } from "mocha";
import moment from "moment";
import assert from "node:assert/strict";
import type { ReadStream } from "node:fs";
import { mkdir, readFile, rm, rmdir, stat } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { Container } from "typedi";
import { filesFolder, tempFolder } from "../../../src/config/constants";
import InRequest from "../../../src/domain/in-request";
import SimpleUser, { type ThumbnailBackground } from "../../../src/domain/simple-user";
import type ImageDto from "../../../src/dto/image.dto";
import ListLocalRepo from "../../../src/persistence/repos/local/list.local.repo";
import type CodexThumbnailService from "../../../src/service/codex-thumbnail.service";
import type IImageEditingService from "../../../src/service/i-service/i-image-editing.service";
import type IImageService from "../../../src/service/i-service/i-image.service";
import type IInRequestService from "../../../src/service/i-service/i-in-request.service";
import type ISimpleUserService from "../../../src/service/i-service/i-simpleUser.service";
import LocalConvoMemoryService from "../../../src/service/telegram-bot/local-convo-memory.service";
import { parseTelegramUserId } from "../../../src/service/telegram-bot/telegram-user-id";
import { theDate } from "../../../src/service/telegram-bot/text-formatting.service";
import type { Bot } from "../../../src/service/telegram-bot/types/botgram";
import type { InlineKeyboardButton } from "../../../src/service/telegram-bot/types/model";

const adminId = 9000000401;
const editorId = 9000000402;
const visitorId = 9000000403;
const text = "https://youtu.be/example\n\n▶ Meditation";
const audio = { audio: { file_id: "audio", duration: 1 } };
const photo = { photo: [ { file_id: "photo", width: 100, height: 100 } ] };
const audioPath = `${ tempFolder }/${ editorId }`;

class TestList extends ListLocalRepo {}

interface TestBot extends Bot {
  processMessage(message: object): Promise<void>;
}

describe("Telegram user IDs", () => {
  it("accepts positive decimal IDs through Telegram's 52-bit limit", () => {
    assert.equal(parseTelegramUserId("1"), 1);
    assert.equal(parseTelegramUserId(" 00042 "), 42);
    assert.equal(parseTelegramUserId("4503599627370495"), 4503599627370495);
  });

  it("rejects missing, non-decimal, zero, multiple and out-of-range IDs", () => {
    for (const value of [ "", "0", "-1", "+1", "1.5", "1e3", "0x10", "@name",
      "12 34", "12\n34", "4503599627370496", "9007199254740993" ]) {
      assert.equal(parseTelegramUserId(value), undefined, value);
    }
  });
});

describe("Telegram permissions through Botgram", () => {
  let config: typeof import("../../../src/config").default;
  let BotUtilsService: typeof import("../../../src/service/telegram-bot/bot-utils.service").default;
  let BotService: typeof import("../../../src/service/telegram-bot/bot.service").default;
  let ListsService: typeof import("../../../src/service/telegram-bot/commands/lists.service").default;
  let PtService: typeof import("../../../src/service/telegram-bot/commands/pt.service").default;
  let ImageCommands: typeof import("../../../src/service/telegram-bot/commands/image.commands").default;
  const botgram: (token: string, options: { autodetect: boolean }) => TestBot = require("botgram");
  const testEnv = {
    RUNNING_ENV: "test", DB_TYPE: "mongodb", BOT_TOKEN: "test-token", ADMIN_CHAT_ID: String(adminId),
    CHANNEL: "test_channel",
  };
  const previousEnv = new Map(Object.keys(testEnv).map(key => [ key, process.env[key] ]));
  const originalFetch = globalThis.fetch;
  let originalRunningEnv: string;
  let memory: LocalConvoMemoryService;
  let whitelist: TestList;
  let blacklist: TestList;
  let bot: TestBot;
  let replies: string[];
  let keyboard: InlineKeyboardButton[][] | undefined;
  let messageId: number;
  let keyboardEdits: { chat_id: number; message_id: number; reply_markup: { inline_keyboard: unknown[] } }[];
  let rejectKeyboardEdits: boolean;
  let rejectNextPrompt: boolean;
  let callbackAnswers: { callback_query_id: string; text?: string; show_alert?: boolean }[];
  let updateId: number;
  let activity: { id: number, username?: string }[];
  let notifications: string[];
  let savedImages: ImageDto[];
  let downloadedFiles: string[];
  let telegramMethods: string[];
  let telegramUploads: Awaited<ReturnType<Request["formData"]>>[];
  let reviewPhotos: { chatId: number; photo: Buffer; caption?: string }[];
  let thumbnails: { title: string; date: string; photo: Buffer; offset?: number }[];
  let failGeneration: boolean;
  let failUpload: boolean;
  let ai: Pick<CodexThumbnailService, 'state' | 'start'>;
  let aiRequests: Parameters<CodexThumbnailService['start']>[0][];
  let nextUpload: Promise<void>;
  let legacyBackgrounds: Map<number, string>;
  let savedBackgrounds: Map<number, ThumbnailBackground>;
  let writeBackground: ISimpleUserService['setLastThumbnailBackground'];
  let gallery: Map<string, Buffer>;
  let unavailableFiles: Set<string>;
  const galleryPhoto = Buffer.from('selected gallery photo');
  const uploadedBackground = Buffer.from('file contents');
  let tempFolderCreated: boolean;

  function mockFetch(handler: (request: Request) => Promise<Response>) {
    globalThis.fetch = Object.assign(
        (input: string | URL | Request, options?: RequestInit) => {
          const request = input instanceof Request ? new Request(input, options) : new Request(String(input), options);
          return handler(request);
        },
        { preconnect: originalFetch.preconnect },
    );
  }

  before(async () => {
    Object.assign(process.env, testEnv);
    config = require("../../../src/config").default;
    originalRunningEnv = config.runningEnv;
    BotUtilsService = require("../../../src/service/telegram-bot/bot-utils.service").default;
    BotService = require("../../../src/service/telegram-bot/bot.service").default;
    ListsService = require("../../../src/service/telegram-bot/commands/lists.service").default;
    PtService = require("../../../src/service/telegram-bot/commands/pt.service").default;
    ImageCommands = require("../../../src/service/telegram-bot/commands/image.commands").default;
    tempFolderCreated = !!(await mkdir(tempFolder, { recursive: true }));
  });

  after(async () => {
    if (tempFolderCreated) await rmdir(tempFolder);
    config.runningEnv = originalRunningEnv;
    for (const [ key, value ] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    config.runningEnv = "production";
    memory = new LocalConvoMemoryService();
    whitelist = new TestList();
    blacklist = new TestList();
    replies = [];
    keyboard = undefined;
    messageId = 1;
    keyboardEdits = [];
    rejectKeyboardEdits = false;
    rejectNextPrompt = false;
    callbackAnswers = [];
    updateId = 0;
    activity = [];
    notifications = [];
    savedImages = [];
    downloadedFiles = [];
    telegramMethods = [];
    telegramUploads = [];
    reviewPhotos = [];
    thumbnails = [];
    failGeneration = false;
    failUpload = false;
    aiRequests = [];
    legacyBackgrounds = new Map();
    savedBackgrounds = new Map();
    writeBackground = async (id, background) => { savedBackgrounds.set(id, background); };
    gallery = new Map([ [ 'gallery', galleryPhoto ] ]);
    unavailableFiles = new Set();
    ai = {
      state: 'enabled',
      start(request) {
        aiRequests.push(request);
        return { status: 'started', result: request.acknowledge().then(() => {
          return { status: 'ready', png: Buffer.from('ai-thumbnail'), metQualityTarget: false };
        }) };
      },
    };
    let uploaded!: () => void;
    nextUpload = new Promise<void>(resolve => { uploaded = resolve; });
    Container.set(config.deps.service.convoMemory.name, memory);

    const botUtils = new BotUtilsService();
    botUtils.sendMessage = async (_, message) => { notifications.push(message); };
    const requests = {
      async addInRequest(user: typeof activity[number]) {
        activity.push(user);
        return InRequest.create(new SimpleUser(user), Date.now());
      },
      async getLastWeekRequests() { return [ { user: "editor", requests: 2 } ]; },
    } as IInRequestService;
    const lists = new ListsService(whitelist, blacklist, botUtils);
    const pt = new PtService(memory, botUtils, lists);
    const images = new ImageCommands(lists, memory, {
      async generate(photo, date, title, options) {
        thumbnails.push({ title, date, photo, offset: options?.imgAlign });
        if (failGeneration) throw new Error('Canvas failed');
        return Buffer.from("thumbnail");
      },
    } as IImageEditingService, {
      async getById(id) {
        const file = gallery.get(id);
        return file ? { domainId: id, file: { domainId: id, file, id } } : null;
      },
      async save(image) {
        savedImages.push(image);
        return image;
      },
    } as IImageService, botUtils, {
      async getUserById(id) {
        return new SimpleUser({
          id, chosenPhotoId: legacyBackgrounds.get(id), lastThumbnailBackground: savedBackgrounds.get(id),
        });
      },
      async setLastThumbnailBackground(id, background) { await writeBackground(id, background); },
    } as ISimpleUserService, ai);

    bot = botgram(testEnv.BOT_TOKEN, { autodetect: false });
    bot.stop();
    bot.callMethod = (method, parameters, callback) => {
      if (method === "answerCallbackQuery") {
        callbackAnswers.push(parameters as typeof callbackAnswers[number]);
        queueMicrotask(() => callback(null, true));
        return;
      }
      if (method === "editMessageReplyMarkup") {
        keyboardEdits.push(parameters as typeof keyboardEdits[number]);
        queueMicrotask(() => callback(rejectKeyboardEdits ? {
          req: {
            method, parameters: [ parameters ], stack: "",
          },
        } : null));
        return;
      }
      const payload = parameters as {
        text?: string; caption?: string; photo?: Buffer; chat_id: number;
        reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
      };
      if (payload.reply_markup && rejectNextPrompt) {
        rejectNextPrompt = false;
        const error = Object.assign(new Error('Test prompt delivery failed'), {
          req: {
            method, parameters: [ parameters ], stack: '',
          },
        });
        queueMicrotask(() => callback(error));
        return;
      }
      if (method === 'sendPhoto') {
        assert.ok(Buffer.isBuffer(payload.photo));
        reviewPhotos.push({ chatId: payload.chat_id, photo: Buffer.from(payload.photo), caption: payload.caption });
      }
      replies.push(payload.caption ?? payload.text ?? 'Media');
      keyboard = payload.reply_markup?.inline_keyboard;
      const sentId = ++messageId;
      const respond = () => callback(null, {
        message_id: sentId,
        date: 1,
        chat: { id: payload.chat_id, type: "private", first_name: "Test" },
        from: { id: 100, first_name: "Bot" },
        ...(method === 'sendPhoto'
            ? { ...structuredClone(photo), caption: payload.caption }
            : { text: payload.text ?? 'Media' }),
      });
      if (method === "sendAudio") {
        telegramMethods.push(method);
        const { audio: stream } = parameters as { audio: ReadStream };
        stream.on("error", callback);
        stream.on("end", respond);
        stream.resume();
      } else {
        queueMicrotask(respond);
      }
    };
    bot.fileLoad = ((file, callback) => {
      const id = typeof file === 'string' ? file : file.id;
      downloadedFiles.push(id);
      if (unavailableFiles.has(id)) return callback(new Error('Telegram file unavailable'));
      callback(null, uploadedBackground);
    }) as Bot["fileLoad"];
    mockFetch(async request => {
      const url = new URL(request.url);
      assert.equal(url.origin, "https://api.telegram.org");
      assert.equal(request.method, "POST");
      telegramMethods.push(url.pathname.split("/").at(-1)!);
      telegramUploads.push(await request.formData());
      uploaded();
      return Response.json({ ok: !failUpload });
    });

    new BotService(requests, botUtils, memory, lists, pt, images).registerCommands(bot);
  });

  afterEach(async () => {
    Container.remove(config.deps.service.convoMemory.name);
    globalThis.fetch = originalFetch;
    await rm(audioPath, { force: true });
  });

  function send(id: number, input: object | string, username?: string, chatId = id) {
    return bot.processMessage({
      message_id: 1,
      date: 1,
      chat: { id: chatId, type: "private", first_name: "Test" },
      from: { id, first_name: "Test", username },
      ...(typeof input === "string" ? { text: input } : structuredClone(input)),
    });
  }

  function press(id: number, button: { data: string; messageId: number }, {
    chatId = id, type = "private", inaccessible = false,
  } = {}): Promise<void> {
    updateId++;
    const update = {
      update_id: updateId,
      callback_query: {
        id: String(updateId),
        from: { id, first_name: "Test" },
        data: button.data,
        message: {
          message_id: button.messageId,
          date: inaccessible ? 0 : 1,
          chat: { id: chatId, type, first_name: "Test", title: "Test" },
          ...(inaccessible ? {} : { from: { id: 100, first_name: "Bot" }, text: "Menu" }),
        },
      },
    };
    return bot.processUpdate(update);
  }

  function button(label: string) {
    const data = keyboard?.flat().find(key => key.text === label)?.callback_data;
    assert.ok(data, `Expected a button labeled ${ label }`);
    assert.ok(Buffer.byteLength(data) <= 64);
    return { data, messageId };
  }

  it("asks for a title from the standard menu and generates only after confirmation", async () => {
    await send(visitorId, "/start");
    await press(visitorId, button("Ajuda"));
    assert.match(replies.at(-1)!, /Telegram e Signal/);
    assert.match(replies.at(-1)!, /CRIAR IMAGEM/);
    await press(visitorId, button("Voltar ao menu"));
    const cover = button("Criar capa para YouTube");
    await press(visitorId, cover);
    assert.match(replies.at(-1)!, /Envia o título/);
    await send(visitorId, "   ");
    assert.match(replies.at(-1)!, /Envia o título/);
    await send(visitorId, "  Meditação de hoje  ");

    const bundled = await readFile(`${ filesFolder }/rapaz.jpg`);
    const { day, month, year } = theDate();
    const date = moment([ year, month - 1, day ]).locale('pt-pt').format('DD MMMM YYYY');
    assert.deepEqual(reviewPhotos.at(-1), {
      chatId: visitorId, photo: bundled,
      caption: `Título: Meditação de hoje\nData: ${ date }\nFundo: Imagem incluída (rapaz.jpg)`,
    });
    assert.deepEqual(keyboard?.flat().map(key => key.text), [
      'CRIAR IMAGEM', 'Alterar título', 'Alterar data', 'Alterar imagem', 'Cancelar',
    ]);
    assert.equal(thumbnails.length, 0);
    assert.equal(telegramUploads.length, 0);

    const create = button('CRIAR IMAGEM');
    await Promise.all([ press(visitorId, create), press(visitorId, create) ]);
    assert.deepEqual(thumbnails, [ { title: 'Meditação de hoje', date, photo: bundled, offset: undefined } ]);
    assert.deepEqual(telegramMethods, [ "sendPhoto" ]);
    assert.equal(telegramUploads[0].get("chat_id"), String(visitorId));
    const uploadedPhoto = telegramUploads[0].get("photo");
    assert.ok(uploadedPhoto instanceof File);
    assert.equal(uploadedPhoto.name, "capa.png");
    assert.equal(uploadedPhoto.type, "image/png");
    assert.equal(await uploadedPhoto.text(), "thumbnail");
    assert.equal(await memory.exists(visitorId), false);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);
    assert.ok(activity.every(user => user.id === visitorId));
  });

  it('reviews a standard slash title immediately and keeps its alignment after edits', async () => {
    await send(visitorId, '/pt_img (0.5) Título inicial');
    assert.match(replies.at(-1)!, /Título: Título inicial/);
    assert.equal(thumbnails.length, 0);
    const oldCreate = button('CRIAR IMAGEM');
    await press(visitorId, button('Alterar título'));
    await send(visitorId, '   ');
    assert.match(replies.at(-1)!, /Envia o título/);
    await send(visitorId, '  Título revisto  ');
    assert.match(replies.at(-1)!, /Título: Título revisto/);
    await press(visitorId, oldCreate);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);
    assert.equal(thumbnails.length, 0);
    await press(visitorId, button('CRIAR IMAGEM'));
    assert.equal(thumbnails[0]?.title, 'Título revisto');
    assert.equal(thumbnails[0]?.offset, 0.5);
  });

  it('accepts a typed leap day and requires a fresh review before rendering', async () => {
    await send(visitorId, '/pt_img Uma capa');
    const oldCreate = button('CRIAR IMAGEM');
    await press(visitorId, button('Alterar data'));
    assert.match(replies.at(-1)!, /DD\/MM\/AAAA/);
    assert.deepEqual(keyboard?.flat().map(key => key.text), [ 'Voltar à revisão', 'Cancelar tarefa' ]);
    await send(visitorId, '29/02/2024');
    assert.match(replies.at(-1)!, /Data: 29 fevereiro 2024/);
    await press(visitorId, oldCreate);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);
    assert.equal(thumbnails.length, 0);
    await press(visitorId, button('CRIAR IMAGEM'));
    assert.equal(thumbnails[0]?.date, '29 fevereiro 2024');
  });

  it('keeps the reviewed date when backing out of an edit and lets users cancel the draft', async () => {
    await send(adminId, '/pt_img_ai Uma capa');
    await press(adminId, button('Alterar data'));
    await send(adminId, '01/03/2024');
    await press(adminId, button('Alterar data'));
    assert.match(replies.at(-1)!, /Data atual: 01\/03\/2024/);
    await send(adminId, '31/02/2024');
    assert.match(replies.at(-1)!, /Data inválida/);
    await press(adminId, button('Voltar à revisão'));
    assert.match(replies.at(-1)!, /Data: 01 março 2024/);

    await press(adminId, button('Alterar data'));
    await press(adminId, button('Cancelar tarefa'));
    assert.equal(await memory.exists(adminId), false);
    assert.equal(aiRequests.length, 0);
  });

  it('reviews the full title when it exceeds the photo caption limit', async () => {
    const title = '🙏'.repeat(2100) + ' fim';
    await send(visitorId, `/pt_img ${ title }`);
    assert.equal(reviewPhotos.at(-1)?.caption, undefined);
    assert.ok(replies.slice(1).join('').startsWith(`Título: ${ title }\n`));
    await press(visitorId, button('CRIAR IMAGEM'));
    assert.equal(thumbnails[0]?.title, title);
  });

  it("delivers a preview in the chat after receiving audio and text", async () => {
    await send(editorId, "/menu");
    await press(editorId, button("Pré-visualizar meditação"));
    await send(editorId, audio);
    assert.match(replies.at(-1)!, /envia o texto/);
    const cancel = button("Cancelar tarefa");
    await send(editorId, text);
    assert.deepEqual(telegramMethods, [ "sendAudio" ]);
    assert.match(replies.at(-1)!, /youtu\.be\/example/);
    assert.equal(keyboard, undefined);
    assert.equal(await memory.exists(editorId), false);
    await assert.rejects(stat(audioPath), { code: "ENOENT" });
    assert.ok(keyboardEdits.some(edit => edit.message_id === cancel.messageId));
    await press(editorId, cancel);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);
  });

  it('requires editor access for the AI menu, slash command and confirmation', async () => {
    await send(visitorId, '/images');
    assert.ok(keyboard?.flat().every(key => key.text !== 'Criar capa com IA'));
    await send(visitorId, '/pt_img_ai Um título');
    assert.match(replies.at(-1)!, /approved editors/);

    await whitelist.add(editorId);
    await send(editorId, '/images');
    const aiMenu = button('Criar capa com IA');
    await whitelist.remove(editorId);
    await press(editorId, aiMenu);
    assert.match(replies.at(-1)!, /approved editors/);
    assert.equal(await memory.exists(editorId), false);

    await whitelist.add(editorId);
    await send(editorId, '/pt_img_ai Um título');
    assert.match(replies.at(-1)!, /Título: Um título/);
    await whitelist.remove(editorId);
    await press(editorId, button('CRIAR IMAGEM'));
    assert.match(replies.at(-1)!, /approved editors/);
    assert.equal(await memory.exists(editorId), false);
    assert.deepEqual(aiRequests, []);
    assert.deepEqual(savedBackgrounds, new Map());
  });

  it('checks editor access again after reloading the reviewed photo', async () => {
    await whitelist.add(editorId);
    await send(editorId, '/pt_img_ai');
    assert.match(replies.at(-1)!, /Envia o título/);
    await send(editorId, 'Uma capa');
    await press(editorId, button('Alterar imagem'));
    await send(editorId, photo);
    const fileLoad = bot.fileLoad;
    bot.fileLoad = ((file, callback) => {
      void whitelist.remove(editorId).then(() => fileLoad(file, callback));
    }) as Bot["fileLoad"];

    await press(editorId, button('CRIAR IMAGEM'));
    assert.match(replies.at(-1)!, /approved editors/);
    assert.equal(await memory.exists(editorId), false);
    assert.equal(aiRequests.length, 0);
  });

  it('reviews all AI menu edits before sending the confirmed inputs to the renderer', async () => {
    legacyBackgrounds.set(adminId, 'gallery');
    await send(adminId, '/images');
    await press(adminId, button('Criar capa com IA'));
    assert.match(replies.at(-1)!, /Envia o título/);
    await send(adminId, { ...photo, caption: 'Isto está na legenda' });
    assert.match(replies.at(-1)!, /Envia o título/);
    assert.deepEqual(downloadedFiles, []);
    await send(adminId, 'A fé e a oração');
    assert.match(replies.at(-1)!, /Fundo: Galeria \(gallery\)/);
    assert.deepEqual(reviewPhotos.at(-1)?.photo, galleryPhoto);

    await press(adminId, button('Alterar título'));
    await send(adminId, 'O valor da oração');
    await press(adminId, button('Alterar data'));
    for (const invalid of [ '31/04/2026', '29/02/2025', '9/02/2024', '12/10/0000', '2024-02-29', audio ]) {
      await send(adminId, invalid);
      assert.match(replies.at(-1)!, /Data inválida.*DD\/MM\/AAAA/);
      assert.equal(await memory.getCommand(adminId), 'pt_img_ai');
    }
    await send(adminId, '29/02/2024');
    assert.match(replies.at(-1)!, /Data: 29 fevereiro 2024/);
    await press(adminId, button('Alterar imagem'));
    await send(adminId, 'missing');
    assert.match(replies.at(-1)!, /não está disponível/);
    await send(adminId, photo);
    assert.deepEqual(reviewPhotos.at(-1)?.photo, uploadedBackground);
    assert.match(replies.at(-1)!, /Título: O valor da oração\nData: 29 fevereiro 2024\nFundo: Foto enviada no Telegram/);
    assert.equal(aiRequests.length, 0);
    assert.equal(telegramUploads.length, 0);

    await press(adminId, button('CRIAR IMAGEM'));
    await nextUpload;
    await setImmediate();
    assert.deepEqual(notifications, [ 'Vou criar a capa com IA.' ]);
    assert.equal(await memory.exists(adminId), false);
    assert.deepEqual(downloadedFiles, [ 'photo', 'photo' ]);
    assert.equal(aiRequests[0]?.title, 'O valor da oração');
    assert.equal(aiRequests[0]?.date, '29 fevereiro 2024');
    assert.deepEqual(await aiRequests[0].background(), uploadedBackground);
    assert.equal(telegramUploads[0].get('chat_id'), String(adminId));
    assert.match(String(telegramUploads[0].get('caption')), /objetivo de qualidade/);
    assert.equal(await (telegramUploads[0].get('photo') as File).text(), 'ai-thumbnail');

    await send(adminId, '/pt_img A próxima capa');
    assert.deepEqual(reviewPhotos.at(-1)?.photo, uploadedBackground);
    assert.match(replies.at(-1)!, /Fundo: Foto enviada no Telegram/);
    await send(adminId, '/chosen_img');
    assert.match(replies.at(-1)!, /Foto enviada no Telegram/);
  });

  it('keeps an AI draft while busy and rechecks availability when the user retries', async () => {
    let finish!: (result: { status: 'failed' }) => void;
    const result = new Promise<{ status: 'failed' }>(resolve => { finish = resolve; });
    ai.start = request => {
      if (aiRequests.length) return { status: 'busy' };
      aiRequests.push(request);
      void request.acknowledge();
      return { status: 'started', result };
    };
    await send(adminId, '/pt_img_ai Primeiro título');
    await press(adminId, button('CRIAR IMAGEM'));
    await send(adminId, '/pt_img_ai Segundo título');
    const busyCreate = button('CRIAR IMAGEM');
    await press(adminId, busyCreate);
    assert.match(replies.at(-1)!, /Já está a ser criada/);
    assert.match(replies.at(-1)!, /Segundo título/);
    assert.equal(aiRequests.length, 1);
    assert.equal(await memory.getCommand(adminId), 'pt_img_ai');
    const retryCreate = button('CRIAR IMAGEM');
    await press(adminId, busyCreate);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);

    Object.assign(ai, { state: 'disabled' });
    await press(adminId, retryCreate);
    assert.match(replies.at(-1)!, /indisponível/);
    assert.equal(aiRequests.length, 1);
    finish({ status: 'failed' });
    await setImmediate();
    assert.match(notifications.at(-1)!, /Não consegui criar a capa/);
    assert.equal(savedBackgrounds.has(adminId), false);

    Object.assign(ai, { state: 'enabled' });
    ai.start = request => {
      aiRequests.push(request);
      return { status: 'started', result: Promise.resolve({
        status: 'ready', png: Buffer.from('ai-thumbnail'), metQualityTarget: true,
      }) };
    };
    await press(adminId, button('CRIAR IMAGEM'));
    await nextUpload;
    assert.equal(aiRequests[1]?.title, 'Segundo título');
    assert.equal(await memory.exists(adminId), false);
  });

  it('reports a bad AI configuration while keeping Canvas previews available', async () => {
    Object.assign(ai, { state: 'misconfigured' });
    await send(adminId, '/images');
    assert.ok(keyboard?.flat().every(key => key.text !== 'Criar capa com IA'));
    await send(adminId, '/pt_img_ai');
    assert.match(replies.at(-1)!, /erro de configuração/);
    await send(adminId, '/pt_img Uma prévia');
    await press(adminId, button('CRIAR IMAGEM'));
    assert.deepEqual(telegramMethods, [ 'sendPhoto' ]);
  });

  it('uses a gallery shortcut only for an active draft and shares delivered defaults per user', async () => {
    await send(adminId, '/img_choose gallery');
    assert.match(replies.at(-1)!, /Começa uma capa/);
    assert.equal(savedBackgrounds.has(adminId), false);

    await send(adminId, '/pt_img');
    await send(adminId, '/img_choose missing');
    assert.match(replies.at(-1)!, /identificador válido/);
    await send(adminId, '/img_choose gallery');
    assert.match(replies.at(-1)!, /Envia o título/);
    await send(adminId, 'Capa com galeria');
    assert.deepEqual(reviewPhotos.at(-1)?.photo, galleryPhoto);
    const create = button('CRIAR IMAGEM');
    await send(adminId, '/chosen_img');
    assert.match(replies.at(-1)!, /rapaz\.jpg/);
    await press(adminId, create);
    assert.deepEqual(savedBackgrounds.get(adminId), { kind: 'gallery', id: 'gallery' });

    await send(editorId, '/pt_img Outra conta');
    assert.match(replies.at(-1)!, /rapaz\.jpg/);
    await send(adminId, '/pt_img_ai Outra capa');
    assert.deepEqual(reviewPhotos.at(-1)?.photo, galleryPhoto);
    assert.match(replies.at(-1)!, /Fundo: Galeria \(gallery\)/);
    assert.deepEqual(aiRequests, []);
  });

  it('reports and previews the legacy gallery or bundled background when a saved reference is unavailable', async () => {
    savedBackgrounds.set(adminId, { kind: 'telegram', id: 'missing-photo' });
    unavailableFiles.add('missing-photo');
    legacyBackgrounds.set(adminId, 'gallery');
    await send(adminId, '/chosen_img');
    assert.match(replies.at(-1)!, /Galeria \(gallery\)/);
    await send(adminId, '/pt_img A capa');
    assert.deepEqual(reviewPhotos.at(-1)?.photo, galleryPhoto);
    await send(adminId, '/cancel');
    assert.deepEqual(savedBackgrounds.get(adminId), { kind: 'telegram', id: 'missing-photo' });

    gallery.delete('gallery');
    await send(adminId, '/chosen_img');
    assert.match(replies.at(-1)!, /rapaz\.jpg/);
    await send(adminId, '/pt_img_ai A capa');
    assert.deepEqual(reviewPhotos.at(-1)?.photo, await readFile(`${ filesFolder }/rapaz.jpg`));
  });

  it('requires a new review when the selected background disappears or changes', async () => {
    await send(visitorId, '/pt_img Uma capa');
    await press(visitorId, button('Alterar imagem'));
    await send(visitorId, photo);
    unavailableFiles.add('photo');
    const missingPhotoCreate = button('CRIAR IMAGEM');
    await press(visitorId, missingPhotoCreate);
    assert.match(replies.at(-1)!, /não está disponível/);
    assert.equal(thumbnails.length, 0);
    await send(visitorId, 'gallery');
    assert.deepEqual(reviewPhotos.at(-1)?.photo, galleryPhoto);
    await press(visitorId, missingPhotoCreate);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);

    const replacement = Buffer.from('another gallery photo');
    gallery.set('gallery', replacement);
    await press(visitorId, button('CRIAR IMAGEM'));
    assert.match(replies.at(-1)!, /imagem de fundo mudou/);
    assert.deepEqual(reviewPhotos.at(-1)?.photo, replacement);
    assert.equal(thumbnails.length, 0);
    await press(visitorId, button('CRIAR IMAGEM'));
    assert.deepEqual(thumbnails[0]?.photo, replacement);
  });

  it('preserves the saved background after a failed render, failed upload, or cancellation', async () => {
    const lastBackground: ThumbnailBackground = { kind: 'gallery', id: 'gallery' };
    savedBackgrounds.set(visitorId, lastBackground);
    await send(visitorId, '/pt_img Uma capa');
    await press(visitorId, button('Alterar imagem'));
    await send(visitorId, photo);
    failGeneration = true;
    await press(visitorId, button('CRIAR IMAGEM'));
    assert.match(replies.at(-1)!, /Podes tentar novamente/);
    assert.equal(telegramUploads.length, 0);
    assert.deepEqual(savedBackgrounds.get(visitorId), lastBackground);

    failGeneration = false;
    failUpload = true;
    await press(visitorId, button('CRIAR IMAGEM'));
    assert.match(replies.at(-1)!, /Podes tentar novamente/);
    assert.equal(telegramUploads.length, 1);
    assert.deepEqual(savedBackgrounds.get(visitorId), lastBackground);

    const cancelledCreate = button('CRIAR IMAGEM');
    await press(visitorId, button('Cancelar'));
    assert.match(replies.at(-1)!, /Tarefa cancelada/);
    assert.equal(await memory.exists(visitorId), false);
    await press(visitorId, cancelledCreate);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);
    assert.equal(thumbnails.length, 2);
    assert.deepEqual(savedBackgrounds.get(visitorId), lastBackground);
  });

  it('saves the background in delivery order when an earlier AI job finishes after a standard cover', async () => {
    const standardBackground: ThumbnailBackground = { kind: 'gallery', id: 'gallery' };
    const aiBackground: ThumbnailBackground = { kind: 'telegram', id: 'photo' };
    let finishAi!: () => void;
    const aiCanFinish = new Promise<void>(resolve => { finishAi = resolve; });
    ai.start = () => ({
      status: 'started', result: aiCanFinish.then(() => ({
        status: 'ready' as const, png: Buffer.from('ai-thumbnail'), metQualityTarget: true,
      })),
    });
    let beginWrite!: () => void;
    let releaseWrite!: () => void;
    const firstWriteStarted = new Promise<void>(resolve => { beginWrite = resolve; });
    const firstWriteCanFinish = new Promise<void>(resolve => { releaseWrite = resolve; });
    const writes: ThumbnailBackground[] = [];
    writeBackground = async (id, background) => {
      writes.push(background);
      if (writes.length === 1) {
        beginWrite();
        await firstWriteCanFinish;
      }
      savedBackgrounds.set(id, background);
    };

    await send(adminId, '/pt_img_ai Capa demorada');
    await press(adminId, button('Alterar imagem'));
    await send(adminId, photo);
    await press(adminId, button('CRIAR IMAGEM'));

    await send(adminId, '/pt_img Capa rápida');
    await send(adminId, '/img_choose gallery');
    const standardDelivery = press(adminId, button('CRIAR IMAGEM'));
    await firstWriteStarted;
    finishAi();
    await setImmediate();
    assert.deepEqual(await Promise.all(telegramUploads.map(form => (form.get('photo') as File).text())),
        [ 'thumbnail', 'ai-thumbnail' ]);
    assert.deepEqual(writes, [ standardBackground ]);
    releaseWrite();
    await standardDelivery;

    await send(adminId, '/pt_img Próxima capa');
    assert.deepEqual(writes, [ standardBackground, aiBackground ]);
    assert.deepEqual(savedBackgrounds.get(adminId), aiBackground);
    assert.deepEqual(reviewPhotos.at(-1)?.photo, uploadedBackground);
  });

  it('keeps the previous background when an asynchronous AI upload fails', async () => {
    const previous: ThumbnailBackground = { kind: 'gallery', id: 'gallery' };
    savedBackgrounds.set(adminId, previous);
    failUpload = true;
    await send(adminId, '/pt_img_ai Capa com IA');
    await press(adminId, button('Alterar imagem'));
    await send(adminId, photo);
    await press(adminId, button('CRIAR IMAGEM'));
    await nextUpload;
    await setImmediate();
    assert.match(notifications.at(-1)!, /Não consegui enviar a capa/);
    assert.deepEqual(savedBackgrounds.get(adminId), previous);
  });

  it("encodes Telegram message parameters and rejects an HTTP error", async () => {
    const message = "Olá & bem-vindo?";
    mockFetch(async request => {
      const url = new URL(request.url);
      assert.equal(request.method, "GET");
      assert.equal(url.pathname, `/bot${ testEnv.BOT_TOKEN }/sendMessage`);
      assert.equal(url.searchParams.get("chat_id"), String(adminId));
      assert.equal(url.searchParams.get("text"), message);
      return Response.json({ ok: false }, { status: 400 });
    });
    await assert.rejects(new BotUtilsService().sendMessage(adminId, message), /Telegram sendMessage failed with HTTP 400/);
  });

  it("allows cancellation only from the latest workflow prompt", async () => {
    await send(visitorId, "/pt");
    const preview = button("Pré-visualizar meditação");
    await press(visitorId, preview);
    const oldCancel = button("Cancelar tarefa");
    await send(visitorId, text);
    assert.match(replies.at(-1)!, /envia o áudio/);
    const newCancel = button("Cancelar tarefa");
    assert.notEqual(newCancel.messageId, oldCancel.messageId);
    await press(visitorId, oldCancel);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);
    assert.equal(await memory.getCommand(visitorId), "pt_testar");
    await press(visitorId, newCancel);
    assert.equal(await memory.exists(visitorId), false);
  });

  it("only accepts one tap from the latest menu even when Telegram cannot remove old buttons", async () => {
    rejectKeyboardEdits = true;
    await send(visitorId, "/menu");
    const previousCover = button("Criar capa para YouTube");
    await send(visitorId, "/menu");
    const cover = button("Criar capa para YouTube");
    const preview = button("Pré-visualizar meditação");
    assert.deepEqual(keyboardEdits[0], {
      chat_id: visitorId, message_id: previousCover.messageId, reply_markup: { inline_keyboard: [] },
    });

    await Promise.all([ press(visitorId, previousCover), press(visitorId, cover), press(visitorId, preview), press(visitorId, cover) ]);
    assert.deepEqual(callbackAnswers.map(answer => answer.show_alert), [ true, undefined, true, true ]);
    assert.equal(await memory.getCommand(visitorId), "pt_img");
    await send(visitorId, "Meditação de hoje");
    await press(visitorId, preview);
    assert.equal(callbackAnswers.at(-1)?.show_alert, true);
    assert.equal(await memory.getCommand(visitorId), 'pt_img');
    assert.equal(thumbnails.length, 0);
    assert.equal(activity.length, 4);
  });

  it("keeps the chat idle when sending the first workflow prompt fails", async () => {
    await send(visitorId, "/menu");
    rejectNextPrompt = true;
    await press(visitorId, button("Criar capa para YouTube"));
    assert.equal(await memory.exists(visitorId), false);
    await send(visitorId, text);
    assert.match(replies.at(-1)!, /youtu\.be\/example/);
    assert.deepEqual(thumbnails, []);
  });

  it("rechecks an editor's access when a current menu button is pressed", async () => {
    await whitelist.add(editorId);
    await send(editorId, "/menu");
    await press(editorId, button("Imagens"));
    const upload = button("Adicionar imagem à galeria");
    await press(editorId, upload);
    await Promise.all([ send(editorId, photo), send(editorId, "thumbnail-id") ]);
    assert.equal(savedImages[0]?.file.id, "thumbnail-id");

    for (const [ command, label ] of [
      [ "/menu", "Publicar meditação no canal" ],
      [ "/images", "Adicionar imagem à galeria" ],
    ]) {
      await send(editorId, command);
      const editorButton = button(label);
      await whitelist.remove(editorId);
      await press(editorId, editorButton);
      assert.match(replies.at(-1)!, /approved editors/);
      assert.equal(await memory.exists(editorId), false);
      await whitelist.add(editorId);
    }

    await whitelist.remove(editorId);
    await send(editorId, "/menu");
    assert.ok(keyboard?.flat().every(key => key.text !== "Publicar meditação no canal"));
    await press(editorId, button("Imagens"));
    assert.ok(keyboard?.flat().every(key => key.callback_data !== upload.data));
    assert.deepEqual(telegramMethods, []);
  });

  it("acknowledges invalid and inaccessible buttons and applies chat admission to valid buttons", async () => {
    await send(visitorId, "/menu");
    const preview = button("Pré-visualizar meditação");
    await press(visitorId, preview, { chatId: editorId });
    await press(visitorId, preview, { chatId: -42, type: "group" });
    await press(visitorId, preview, { inaccessible: true });
    await press(visitorId, { ...preview, data: "menu:unknown" });
    assert.equal(callbackAnswers.length, 4);
    assert.ok(callbackAnswers.every(answer => answer.show_alert && answer.text?.includes("/menu")));
    await blacklist.add(visitorId);
    await press(visitorId, preview);
    assert.match(replies.at(-1)!, /blacklisted/);
    await blacklist.remove(visitorId);
    await send(visitorId, "/menu");
    config.runningEnv = "development";
    await press(visitorId, button("Pré-visualizar meditação"));
    assert.match(replies.at(-1)!, /developing/);
    assert.equal(await memory.exists(visitorId), false);
    assert.equal(activity.length, 2);
    assert.equal(callbackAnswers.length, 6);
  });

  it("validates the configured admin user ID", () => {
    try {
      process.env.ADMIN_CHAT_ID = "4.2e1";
      assert.throws(() => new BotUtilsService(), /ADMIN_CHAT_ID must be a positive decimal/);
    } finally {
      process.env.ADMIN_CHAT_ID = testEnv.ADMIN_CHAT_ID;
    }
  });

  it("allows ordinary formatting and thumbnail previews in production without a handle", async () => {
    await send(visitorId, text);
    await send(visitorId, "/pt_img Meditation");
    await press(visitorId, button('CRIAR IMAGEM'));
    assert.ok(replies.some(reply => reply.includes("[▶ YouTube]")));
    assert.deepEqual(telegramMethods, [ "sendPhoto" ]);
    assert.deepEqual(activity.map(user => user.id), [ visitorId, visitorId, visitorId ]);
    assert.equal(activity[0].username, undefined);
    await send(visitorId, "/img_add");
    await send(visitorId, "/pt_enviar");
    assert.equal(await memory.exists(visitorId), false);
    assert.ok(replies.slice(-2).every(reply => reply.includes("approved editors")));
  });

  it("blocks before recording activity or dispatching commands, even for an allowlisted sender", async () => {
    await whitelist.add(editorId);
    await blacklist.add(editorId);
    await send(editorId, "/pt_enviar", "new_handle");
    assert.deepEqual(activity, []);
    assert.equal(await memory.exists(editorId), false);
    assert.match(replies.at(-1)!, /blacklisted/);
  });

  it("admits the admin and approved senders in development", async () => {
    config.runningEnv = "development";
    await whitelist.add(editorId);
    await send(visitorId, "/start");
    await send(adminId, "/start");
    await send(editorId, "/start");
    assert.deepEqual(activity.map(user => user.id), [ adminId, editorId ]);
    assert.match(replies[0], /developing/);
    assert.match(notifications[0], new RegExp(String(visitorId)));
    assert.equal(notifications.length, 2);
  });

  it("allows the admin to use editor commands without a whitelist entry", async () => {
    assert.deepEqual(await whitelist.fullList(), []);
    await send(adminId, "/img_add");
    assert.equal(await memory.exists(adminId), true);
    await Promise.all([ send(adminId, photo), send(adminId, "thumbnail-id") ]);
    assert.equal(savedImages[0]?.file.id, "thumbnail-id");
    assert.deepEqual(await whitelist.fullList(), []);
  });

  it("restricts list management and reporting to the admin sender", async () => {
    for (const name of [ "whitelist", "blacklist" ]) {
      for (const operation of [ "add", "rm", "all" ]) {
        await send(visitorId, `/${ name }_${ operation } ${ editorId }`, "admin_handle", adminId);
        assert.match(replies.at(-1)!, /Not allowed/);
      }
    }
    assert.deepEqual(await whitelist.fullList(), []);
    assert.deepEqual(await blacklist.fullList(), []);
    await send(visitorId, "/report", "admin_handle", adminId);
    assert.match(replies.at(-1)!, /can't report/);
    await send(adminId, "/report");
    assert.equal(replies.at(-1), "@editor: 2\n");
  });

  for (const name of [ "whitelist", "blacklist" ]) {
    it(`validates ${ name } inputs and manages numeric entries idempotently`, async () => {
      await send(adminId, `/${ name }_add ${ editorId } 111`);
      assert.match(replies.at(-1)!, /positive Telegram user ID/);
      await send(adminId, `/${ name }_rm @editor`);
      assert.match(replies.at(-1)!, /positive Telegram user ID/);
      await send(adminId, `/${ name }_all`);
      assert.equal(replies.at(-1), "List is empty");
      for (const value of [ String(editorId), `0${ editorId }` ]) {
        await send(adminId, `/${ name }_add ${ value }`);
        assert.equal(replies.at(-1), "Done");
      }
      await send(adminId, `/${ name }_all`);
      assert.equal(replies.at(-1), String(editorId));
      await send(adminId, `/${ name }_rm ${ editorId }`);
      assert.equal(replies.at(-1), "Done");
      await send(adminId, `/${ name }_all`);
      assert.equal(replies.at(-1), "List is empty");
    });
  }

  it("keeps editor access after a handle changes or disappears", async () => {
    await whitelist.add(editorId);
    await send(editorId, "/img_add", "old_handle");
    await Promise.all([ send(editorId, photo, "new_handle"), send(editorId, "thumbnail-id") ]);
    assert.equal(savedImages[0]?.file.id, "thumbnail-id");
    assert.equal(await memory.exists(editorId), false);

    await send(visitorId, "/img_add", "old_handle");
    assert.equal(await memory.exists(visitorId), false);
    await send(editorId, "/pt_enviar");
    await Promise.all([ send(editorId, audio), send(editorId, text) ]);
    assert.deepEqual(telegramMethods, [ "sendAudio" ]);
    const upload = telegramUploads[0];
    assert.equal(upload.get("chat_id"), "@test_channel");
    assert.equal(upload.get("parse_mode"), "Markdown");
    assert.match(String(upload.get("caption")), /youtu\.be\/example/);
    assert.match(String(upload.get("duration")), /^\d+$/);
    const uploadedAudio = upload.get("audio");
    assert.ok(uploadedAudio instanceof File);
    assert.equal(uploadedAudio.name, String(editorId));
    assert.equal(await uploadedAudio.text(), "file contents");
    assert.equal(await memory.exists(editorId), false);
    await assert.rejects(stat(audioPath), { code: "ENOENT" });
  });

  const workflows = [
    { command: "img_add", inputs: [ photo, "thumbnail-id" ] },
    { command: "pt_enviar", inputs: [ audio, text ] },
  ];
  for (const { command, inputs } of workflows) {
    for (const [ index, first ] of inputs.entries()) {
      it(`cleans up /${ command } after revocation with ${ typeof first === "string" ? "text" : "media" } first`, async () => {
        await send(adminId, `/whitelist_add ${ editorId }`);
        await send(editorId, `/${ command }`);
        await send(editorId, first);
        assert.equal(await memory.exists(editorId), true);
        await send(adminId, `/whitelist_rm ${ editorId }`);
        await send(editorId, inputs[1 - index]);
        assert.match(replies.at(-1)!, /approved editors/);
        assert.deepEqual(savedImages, []);
        assert.deepEqual(telegramMethods, []);
        assert.equal(await memory.exists(editorId), false);
        await assert.rejects(stat(audioPath), { code: "ENOENT" });
      });
    }

    it(`checks /${ command } permissions again after the final media download`, async () => {
      await whitelist.add(editorId);
      await send(editorId, `/${ command }`);
      await send(editorId, inputs[1]);
      const loadFile = bot.fileLoad;
      bot.fileLoad = ((file, callback) => {
        void whitelist.remove(editorId).then(() => loadFile.call(bot, file, callback));
      }) as Bot["fileLoad"];
      await send(editorId, inputs[0]);
      assert.match(replies.at(-1)!, /approved editors/);
      assert.deepEqual(savedImages, []);
      assert.deepEqual(telegramMethods, []);
      assert.equal(await memory.exists(editorId), false);
      await assert.rejects(stat(audioPath), { code: "ENOENT" });
    });
  }

  it("clears an active upload when a new block prevents the next update from reaching it", async () => {
    await whitelist.add(editorId);
    await send(editorId, "/img_add");
    await send(editorId, photo);
    await blacklist.add(editorId);
    await send(editorId, "thumbnail-id");
    assert.equal(await memory.exists(editorId), false);
    assert.equal(activity.length, 2);
    assert.deepEqual(savedImages, []);
  });
});
