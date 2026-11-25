import type { Server } from "bun";
import { after, before, describe, it } from "mocha";
import mongoose from "mongoose";
import * as assert from "node:assert/strict";
import { Container } from "typedi";
import type ImageDto from "../../../src/dto/image.dto";

describe("[Unit] HTTP server", () => {
  const environmentKeys = [ "RUNNING_ENV", "DB_TYPE", "PORT" ];
  const previousEnvironment = new Map(environmentKeys.map(key => [ key, process.env[key] ]));
  const stateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, "readyState");
  const registeredTokens: string[] = [];
  let connectionState = 0;
  let httpServer: Server<undefined> | undefined;
  let baseUrl: string;
  const images: ImageDto[] = [ "cover one", "cover one.png" ].map(id => ({
    domainId: id,
    file: { domainId: id, id, file: Buffer.from(id) },
  }));

  before(() => {
    process.env.RUNNING_ENV = "test";
    process.env.DB_TYPE = "mongodb";
    process.env.PORT = "0";
    Object.defineProperty(mongoose.connection, "readyState", {
      configurable: true,
      get: () => connectionState,
    });

    const config = require("../../../src/config").default;
    Container.set(config.deps.service.image.name, {
      getById: async (id: string) => images.find(image => image.file.id === id) ?? null,
      getAll: async () => images,
    });
    Container.set(config.deps.service.botUtils.name, { adminChatId: 0, sendMessage: async () => {} });
    registeredTokens.push(config.deps.service.image.name, config.deps.service.botUtils.name, "server");

    require("../../../src/server").default();
    httpServer = Container.get<Server<undefined>>("server");
    baseUrl = `http://127.0.0.1:${ httpServer.port }`;
  });

  after(async () => {
    await httpServer?.stop(true);
    for (const token of registeredTokens) Container.remove(token);
    if (stateDescriptor) Object.defineProperty(mongoose.connection, "readyState", stateDescriptor);
    else Reflect.deleteProperty(mongoose.connection, "readyState");
    for (const [ key, value ] of previousEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("reports unavailable while MongoDB is disconnected", async () => {
    connectionState = 0;
    const response = await fetch(`${ baseUrl }/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable" });
  });

  it("reports ready only while MongoDB is connected", async () => {
    connectionState = 1;
    const response = await fetch(`${ baseUrl }/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });

  it("serves the landing page and gallery as HTML", async () => {
    for (const [ path, title ] of [ [ "/", "10McJ Bot" ], [ "/images", "The images" ] ]) {
      const response = await fetch(`${ baseUrl }${ path }`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
      assert.ok((await response.text()).includes(`<title>${ title }</title>`));
    }
  });

  it("serves both image URL forms and preserves encoded dots in IDs", async () => {
    for (const [ path, id ] of [
      [ "/image/cover%20one", "cover one" ],
      [ "/IMAGE/cover%20one.PNG/", "cover one" ],
      [ "/image/cover%20one%2Epng", "cover one.png" ],
    ]) {
      const response = await fetch(`${ baseUrl }${ path }`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/octet-stream");
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(id));
    }

    const head = await fetch(`${ baseUrl }/image/cover%20one.png`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  });

  it("returns 400 for malformed IDs and 404 for missing images", async () => {
    const invalid = await fetch(`${ baseUrl }/image/%E0%A4%A`);
    assert.equal(invalid.status, 400);
    assert.equal(await invalid.text(), "Bad ID");

    const missing = await fetch(`${ baseUrl }/image/missing.png`);
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), "Image not found");
  });
});
