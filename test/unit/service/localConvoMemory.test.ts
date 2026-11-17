import { beforeEach, describe, it } from "mocha";
import * as assert from "node:assert/strict";

import {
  ConvoError, InfosForText, VideoData,
} from "../../../src/service/i-service/telegram-bot/i-convo-memory.service";
import LocalConvoMemoryService from "../../../src/service/telegram-bot/local-convo-memory.service";

describe("[Unit] Local conversation memory", () => {
  const chatId = 123;
  const otherChatId = -456;
  const text: InfosForText = { telegram: "Telegram", signal: "Signal", date: "29-02-24", descr1: "Title" };
  let service: LocalConvoMemoryService;

  beforeEach(() => {
    service = new LocalConvoMemoryService();
  });

  it("returns null from every getter for an unrecorded chat", async () => {
    assert.equal(await service.exists(chatId), false);
    assert.deepEqual(await Promise.all([
      service.wholeConvo(chatId), service.getCommand(chatId), service.getData(chatId),
      service.getTextData(chatId), service.getText(chatId), service.hasAudio(chatId),
      service.getAddImageData(chatId), service.getVideoData(chatId), service.videoHasAudio(chatId),
      service.getVideoImage(chatId), service.getVideoText(chatId),
    ]), Array(11).fill(null));
  });

  it("refuses updates to an unrecorded chat without creating it", async () => {
    const image = Buffer.from([ 1, 2, 3 ]);
    const results = [
      await service.setData(chatId, { audio: false }),
      await service.setAudio(chatId, true), await service.setText(chatId, text),
      await service.setImg(chatId, image), await service.setImgName(chatId, "Photo"),
      await service.setVideoAudio(chatId, true), await service.setVideoImage(chatId, image),
      await service.setVideoText(chatId, "Title"),
    ];

    assert.deepEqual(results, Array(8).fill(false));
    assert.equal(await service.exists(chatId), false);
  });

  it("keeps conversations isolated between chats and service instances", async () => {
    await service.set(chatId, { command: "text", data: { audio: false } });
    await service.set(otherChatId, { command: "image", data: { name: "Other photo" } });
    assert.equal(await service.setData(chatId, { audio: true, text }), true);

    assert.equal(await service.getCommand(chatId), "text");
    assert.deepEqual(await service.wholeConvo(chatId), { command: "text", data: { audio: true, text } });
    assert.deepEqual(await service.wholeConvo(otherChatId), { command: "image", data: { name: "Other photo" } });
    assert.equal(await new LocalConvoMemoryService().exists(chatId), false);
  });

  it("replaces the previous command and data when a conversation restarts", async () => {
    await service.set(chatId, { command: "text", data: { audio: true, text } });
    await service.set(chatId, { command: "image", data: {} });

    assert.deepEqual(await service.wholeConvo(chatId), { command: "image", data: {} });
    assert.equal(await service.getText(chatId), undefined);
  });

  it("deletes only the selected chat and tolerates repeated deletion", async () => {
    await service.set(chatId, { command: "text", data: { audio: false } });
    await service.set(otherChatId, { command: "image", data: {} });
    await service.delete(chatId);
    await service.delete(chatId);

    assert.equal(await service.exists(chatId), false);
    assert.equal(await service.getData(chatId), null);
    assert.equal(await service.exists(otherChatId), true);
  });

  it("updates text and audio without losing other conversation fields", async () => {
    await service.set(chatId, { command: "text", data: { audio: false } });
    assert.equal(await service.getText(chatId), undefined);
    assert.equal(await service.hasAudio(chatId), false);

    assert.equal(await service.setText(chatId, text), true);
    assert.equal(await service.setAudio(chatId, true), true);
    assert.deepEqual(await service.getText(chatId), text);
    assert.deepEqual(await service.getTextData(chatId), { audio: true, text });

    assert.equal(await service.setAudio(chatId, false), true);
    assert.equal(await service.hasAudio(chatId), false);
    assert.deepEqual(await service.getText(chatId), text);
    assert.equal(await service.getCommand(chatId), "text");
  });

  it("does not apply text or video updates to an image conversation", async () => {
    await service.set(chatId, { command: "image", data: { name: "Photo", image: Buffer.from([ 1, 2, 3 ]) } });

    assert.equal(await service.getTextData(chatId), undefined);
    assert.equal(await service.getText(chatId), undefined);
    assert.equal(await service.hasAudio(chatId), undefined);
    assert.equal(await service.getVideoData(chatId), undefined);
    assert.equal(await service.videoHasAudio(chatId), undefined);
    assert.equal(await service.getVideoImage(chatId), undefined);
    assert.equal(await service.getVideoText(chatId), undefined);
    assert.equal(await service.setText(chatId, text), false);
    assert.equal(await service.setAudio(chatId, true), false);
    assert.equal(await service.setVideoAudio(chatId, true), false);
    assert.equal(await service.setVideoImage(chatId, Buffer.alloc(0)), false);
    assert.equal(await service.setVideoText(chatId, "Title"), false);
    assert.deepEqual(await service.getData(chatId), { name: "Photo", image: Buffer.from([ 1, 2, 3 ]) });
  });

  it("builds image data in stages and preserves the name when replacing an image", async () => {
    const image = Buffer.from([ 1, 2, 3 ]);
    await service.set(chatId, { command: "image", data: {} });

    assert.equal(await service.setImgName(chatId, "Photo"), true);
    assert.equal(await service.setImg(chatId, image), true);
    assert.deepEqual(await service.getAddImageData(chatId), { name: "Photo", image });
    assert.equal(await service.setImg(chatId, Buffer.from([ 4, 5 ])), true);
    assert.deepEqual(await service.getAddImageData(chatId), { name: "Photo", image: Buffer.from([ 4, 5 ]) });
  });

  it("updates video fields independently, including turning audio off", async () => {
    const video: VideoData = { audio: false, image: Buffer.from([ 1 ]), text: "Original title" };
    await service.set(chatId, { command: "video", data: video });
    assert.equal(await service.videoHasAudio(chatId), false);
    assert.deepEqual(await service.getVideoImage(chatId), Buffer.from([ 1 ]));
    assert.equal(await service.getVideoText(chatId), "Original title");

    assert.equal(await service.setVideoAudio(chatId, true), true);
    assert.equal(await service.setVideoText(chatId, "New title"), true);
    assert.equal(await service.setVideoImage(chatId, Buffer.from([ 2, 3 ])), true);
    assert.deepEqual(await service.getVideoData(chatId), {
      audio: true, image: Buffer.from([ 2, 3 ]), text: "New title",
    });
    assert.equal(await service.setVideoAudio(chatId, false), true);
    assert.equal(await service.videoHasAudio(chatId), false);
  });

  it("clears only the affected conversation when creating a ConvoError", async () => {
    await service.set(chatId, { command: "text", data: { audio: false } });
    await service.set(otherChatId, { command: "image", data: {} });

    const error = await ConvoError.new(service, chatId, "reading text");

    assert.ok(error instanceof Error);
    assert.equal(error.name, "ConvoError");
    assert.match(error.message, /\(reading text\)/);
    assert.equal(await service.exists(chatId), false);
    assert.equal(await service.exists(otherChatId), true);
  });
});
