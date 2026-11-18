import axios from "axios";
import { after, afterEach, before, beforeEach, describe, it } from "mocha";
import assert from "node:assert/strict";
import { once } from "node:events";
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
import type { Bot, ReplyQueue } from "../../../src/service/telegram-bot/types/botgram";

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

  reply(): ReplyQueue;
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
  const originalAdapter = axios.defaults.adapter;
  let originalRunningEnv: string;
  let memory: LocalConvoMemoryService;
  let whitelist: TestList;
  let blacklist: TestList;
  let bot: TestBot;
  let replies: string[];
  let activity: { id: number, username?: string }[];
  let notifications: string[];
  let savedImages: ImageDto[];
  let telegramMethods: string[];
  let tempFolderCreated: boolean;

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
    activity = [];
    notifications = [];
    savedImages = [];
    telegramMethods = [];
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
      async generate() { return Buffer.from("thumbnail"); },
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
    bot.reply = () => ({
      text: (message: string) => { replies.push(message); },
      sendGeneric: (_method: string, { text }: { text: string }) => { replies.push(text); },
    }) as ReplyQueue;
    bot.fileLoad = ((_file, callback) => callback(null, Buffer.from("file contents"))) as Bot["fileLoad"];
    axios.defaults.adapter = async request => {
      telegramMethods.push(request.url!.split("/").at(-1)!);
      const drained = once(request.data, "end");
      request.data.resume();
      await drained;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config: request };
    };

    new BotService(requests, botUtils, memory, lists, pt, images).registerCommands(bot);
  });

  afterEach(async () => {
    Container.remove(config.deps.service.convoMemory.name);
    axios.defaults.adapter = originalAdapter;
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
