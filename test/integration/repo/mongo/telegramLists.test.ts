import { before, describe, it } from "mocha";
import mongoose from "mongoose";
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import DbConnector from "../../../../src/persistence/repos/db-connector";
import BlacklistMongoRepo from "../../../../src/persistence/repos/mongodb/blacklist.mongo.repo";
import WhitelistMongoRepo from "../../../../src/persistence/repos/mongodb/whitelist.mongo.repo";

describe("Numeric Telegram lists in MongoDB", () => {
  before(() => DbConnector.getInstance().connect(true));

  const lists = [
    [ "telegram-whitelist", "white-lists", new WhitelistMongoRepo() ],
    [ "telegram-blacklist", "black-lists", new BlacklistMongoRepo() ],
  ] as const;

  for (const [ collection, legacyCollection, repo ] of lists) {
    it(`stores a unique numeric userId in ${ collection }`, async () => {
      const id = randomInt(2 ** 40, 2 ** 42);
      const legacy = mongoose.connection.collection(legacyCollection);
      await legacy.insertOne({ username: String(id) });
      try {
        assert.equal(await repo.contains(id), false);
        await Promise.all(Array.from({ length: 4 }, () => repo.add(id)));
        assert.equal(await repo.contains(id), true);
        assert.deepEqual((await repo.fullList()).filter(userId => userId === id), [ id ]);
        const records = mongoose.connection.collection(collection);
        assert.equal(await records.countDocuments({ userId: { $eq: id, $type: "number" } }), 1);
        await assert.rejects(records.insertOne({ userId: id }), { code: 11000 });
        assert.equal(await repo.remove(id), true);
        assert.equal(await repo.remove(id), false);
        assert.equal(await repo.contains(id), false);
        assert.equal(await legacy.countDocuments({ username: String(id) }), 1);
      } finally {
        await repo.remove(id);
        await legacy.deleteOne({ username: String(id) });
      }
    });
  }
});
