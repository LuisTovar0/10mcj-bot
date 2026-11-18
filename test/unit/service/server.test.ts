import { after, before, describe, it } from "mocha";
import mongoose from "mongoose";
import * as assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { Container } from "typedi";

describe("[Unit] HTTP readiness", () => {
  const environmentKeys = [ "RUNNING_ENV", "DB_TYPE", "PORT" ];
  const previousEnvironment = new Map(environmentKeys.map(key => [ key, process.env[key] ]));
  const stateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, "readyState");
  const registeredTokens: string[] = [];
  let connectionState = 0;
  let httpServer: Server | undefined;
  let baseUrl: string;

  before(async () => {
    process.env.RUNNING_ENV = "test";
    process.env.DB_TYPE = "mongodb";
    process.env.PORT = "0";
    Object.defineProperty(mongoose.connection, "readyState", {
      configurable: true,
      get: () => connectionState,
    });

    const config = require("../../../src/config").default;
    Container.set(config.deps.service.image.name, {});
    Container.set(config.deps.service.botUtils.name, { adminChatId: 0, sendMessage: async () => {} });
    registeredTokens.push(config.deps.service.image.name, config.deps.service.botUtils.name, "server");

    require("../../../src/server").default();
    httpServer = Container.get<Server>("server");
    if (!httpServer.listening) await once(httpServer, "listening");
    const address = httpServer.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${ address.port }`;
  });

  after(async () => {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close(error => error ? reject(error) : resolve());
      });
    }
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
});
