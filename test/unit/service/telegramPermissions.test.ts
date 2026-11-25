import { after, afterEach, before, beforeEach, describe, it } from "mocha";
import assert from "node:assert/strict";
import type { ReadStream } from "node:fs";
import { mkdir, rm, rmdir, stat } from "node:fs/promises";
import { Container } from "typedi";
import { tempFolder } from "../../../src/config/constants";
import InRequest from "../../../src/domain/in-request";
import SimpleUser from "../../../src/domain/simple-user";
import type ImageDto from "../../../src/dto/image.dto";
import ListLocalRepo from "../../../src/persistence/repos/local/list.local.repo";
import type IImageEditingService from "../../../src/service/i-service/i-image-editing.service";
import type IImageService from "../../../src/service/i-service/i-image.service";
import type IInRequestService from "../../../src/service/i-service/i-in-request.service";
import type ISimpleUserService from "../../../src/service/i-service/i-simpleUser.service";
import LocalConvoMemoryService from "../../../src/service/telegram-bot/local-convo-memory.service";
import { parseTelegramUserId } from "../../../src/service/telegram-bot/telegram-user-id";
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
  let telegramMethods: string[];
  let telegramUploads: Awaited<ReturnType<Request["formData"]>>[];
  let thumbnails: { title: string; offset?: number }[];
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
    telegramMethods = [];
    telegramUploads = [];
    thumbnails = [];
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
      async generate(_photo, _date, title, options) {
        thumbnails.push({ title, offset: options?.imgAlign });
        return Buffer.from("thumbnail");
      },
    } as IImageEditingService, {
      async save(image) {
        savedImages.push(image);
        return image;
      },
    } as IImageService, botUtils, {
      async getUserById(id) { return new SimpleUser({ id }); },
    } as ISimpleUserService);

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
        text: string; chat_id: number; reply_markup?: { inline_keyboard: InlineKeyboardButton[][] }
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
      replies.push(payload.text);
      keyboard = payload.reply_markup?.inline_keyboard;
      const sentId = ++messageId;
      const respond = () => callback(null, {
        message_id: sentId,
        date: 1,
        chat: { id: payload.chat_id, type: "private", first_name: "Test" },
        from: { id: 100, first_name: "Bot" },
        text: payload.text ?? "Media",
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
    bot.fileLoad = ((_file, callback) => callback(null, Buffer.from("file contents"))) as Bot["fileLoad"];
    mockFetch(async request => {
      const url = new URL(request.url);
      assert.equal(url.origin, "https://api.telegram.org");
      assert.equal(request.method, "POST");
      telegramMethods.push(url.pathname.split("/").at(-1)!);
      telegramUploads.push(await request.formData());
      return Response.json({ ok: true });
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

  it("opens help and generates a cover from a title sent after pressing the menu button", async () => {
    await send(visitorId, "/start");
    await press(visitorId, button("Ajuda"));
    assert.match(replies.at(-1)!, /Telegram e Signal/);
    await press(visitorId, button("Voltar ao menu"));
    const cover = button("Criar capa para YouTube");
    await Promise.all([ press(visitorId, cover), send(visitorId, "Meditação de hoje") ]);
    assert.deepEqual(thumbnails, [ { title: "Meditação de hoje", offset: undefined } ]);
    assert.deepEqual(telegramMethods, [ "sendPhoto" ]);
    assert.equal(telegramUploads[0].get("chat_id"), String(visitorId));
    const uploadedPhoto = telegramUploads[0].get("photo");
    assert.ok(uploadedPhoto instanceof File);
    assert.equal(uploadedPhoto.name, "capa.png");
    assert.equal(uploadedPhoto.type, "image/png");
    assert.equal(await uploadedPhoto.text(), "thumbnail");
    assert.equal(await memory.exists(visitorId), false);
    assert.equal(callbackAnswers.length, 3);
    assert.ok(activity.every(user => user.id === visitorId));

    await send(visitorId, "/pt_img");
    assert.match(replies.at(-1)!, /Envia o título/);
    await send(visitorId, "/pt_img (0.5) Outro título");
    assert.deepEqual(thumbnails.at(-1), { title: "Outro título", offset: 0.5 });
    assert.equal(await memory.exists(visitorId), false);
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
    assert.equal(await memory.exists(visitorId), false);
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
    assert.ok(replies.some(reply => reply.includes("[▶ YouTube]")));
    assert.deepEqual(telegramMethods, [ "sendPhoto" ]);
    assert.deepEqual(activity.map(user => user.id), [ visitorId, visitorId ]);
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
