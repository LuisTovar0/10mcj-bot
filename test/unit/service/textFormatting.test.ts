import { afterEach, describe, it } from "mocha";
import * as assert from "node:assert/strict";
import { mock } from "node:test";

import BotError from "../../../src/service/telegram-bot/bot-error";
import {
  analyseMsgPT, getDateStr, getFullInfo, inRequestsToString, telegramSignalPT, theDate,
} from "../../../src/service/telegram-bot/text-formatting.service";

describe("[Unit] Text formatting", () => {
  describe("message parsing", () => {
    it("trims the URL and removes title and subtitle Markdown", () => {
      assert.deepEqual(analyseMsgPT("  https://youtu.be/example  \n\n*🙏 Uma meditação*\n_Um subtítulo_"), {
        url: "https://youtu.be/example", descr1: "🙏 Uma meditação", descr2: "Um subtítulo",
      });
    });

    it("accepts a message without a subtitle", () => {
      assert.deepEqual(analyseMsgPT("https://youtu.be/example\n\n*🙏 Uma meditação*"), {
        url: "https://youtu.be/example", descr1: "🙏 Uma meditação", descr2: undefined,
      });
    });

    it("accepts Windows line endings", () => {
      assert.deepEqual(analyseMsgPT("https://youtu.be/example\r\n\r\n*🙏 Meditação*\r\n_Subtítulo_\r\n"), {
        url: "https://youtu.be/example", descr1: "🙏 Meditação", descr2: "Subtítulo",
      });
    });

    for (const message of [ "", "https://youtu.be/example", "https://youtu.be/example\nTitle" ]) {
      it(`rejects a message with fewer than three lines: ${ JSON.stringify(message) }`, () => {
        assert.throws(() => analyseMsgPT(message), (error: unknown) => {
          assert.ok(error instanceof BotError);
          assert.equal(error.name, "BotError");
          assert.match(error.message, /pelo menos 3 linhas/);
          return true;
        });
      });
    }
  });

  describe("Telegram and Signal output", () => {
    const info = { date: "29-02-24", descr1: "🙏 Uma meditação", url: "https://youtu.be/example" };

    for (const descr2 of [ undefined, "Um subtítulo" ]) {
      it(`formats both platforms ${ descr2 ? "with" : "without" } a subtitle`, () => {
        const result = telegramSignalPT({ ...info, descr2 });

        // Full output assertions protect links, Markdown and paragraph spacing.
        assert.equal(result.telegram,
            "29-02-24\n\n*🙏 Uma meditação*" + (descr2 ? "\n_Um subtítulo_" : "") +
            "\n\n[▶ YouTube](https://youtu.be/example)          [🌐 +Info](https://t.me/dezmincomjesus/424)");
        assert.equal(result.signal,
            "29-02-24\n\n🙏 Uma meditação" + (descr2 ? "\n\nUm subtítulo" : "") +
            "\n\n▶ YouTube: https://youtu.be/example\n\n🌐 +Info: https://10minutoscomjesus.org");
      });
    }
  });

  describe("publication date", () => {
    afterEach(() => mock.timers.reset());

    const cases = [
      { name: "before the cutoff", now: new Date(2024, 4, 9, 14, 59, 59), expected: { day: 9, month: 5, year: 2024 } },
      { name: "at the cutoff", now: new Date(2024, 4, 9, 15), expected: { day: 10, month: 5, year: 2024 } },
      { name: "across a month", now: new Date(2024, 3, 30, 15), expected: { day: 1, month: 5, year: 2024 } },
      { name: "on a leap year", now: new Date(2024, 1, 28, 15), expected: { day: 29, month: 2, year: 2024 } },
      { name: "after leap day", now: new Date(2024, 1, 29, 15), expected: { day: 1, month: 3, year: 2024 } },
      { name: "on a normal year", now: new Date(2023, 1, 28, 15), expected: { day: 1, month: 3, year: 2023 } },
      { name: "across a year", now: new Date(2024, 11, 31, 15), expected: { day: 1, month: 1, year: 2025 } },
    ];

    for (const { name, now, expected } of cases) {
      it(`selects the date ${ name }`, () => {
        mock.timers.enable({ apis: [ "Date" ], now });
        assert.deepEqual(theDate(), expected);
      });
    }

    it("formats a single-digit day, a padded month and a two-digit year", () => {
      mock.timers.enable({ apis: [ "Date" ], now: new Date(2024, 1, 9, 10) });
      assert.equal(getDateStr(), "9-02-24");
    });

    it("combines parsed content and the publication date into both messages", () => {
      mock.timers.enable({ apis: [ "Date" ], now: new Date(2024, 1, 29, 10) });
      const info = getFullInfo("https://youtu.be/example\n\n*🙏 Meditação*\n_Subtítulo_");

      assert.equal(info.date, "29-02-24");
      assert.equal(info.url, "https://youtu.be/example");
      assert.equal(info.descr1, "🙏 Meditação");
      assert.equal(info.descr2, "Subtítulo");
      assert.ok(info.telegram.startsWith("29-02-24\n\n*🙏 Meditação*\n_Subtítulo_\n\n"));
      assert.ok(info.signal.startsWith("29-02-24\n\n🙏 Meditação\n\nSubtítulo\n\n"));
      assert.ok(info.telegram.includes("[▶ YouTube](https://youtu.be/example)"));
      assert.ok(info.signal.includes("▶ YouTube: https://youtu.be/example"));
    });
  });

  describe("request statistics", () => {
    it("returns empty text for no requests", () => {
      assert.equal(inRequestsToString([]), "");
    });

    it("preserves user order and request counts", () => {
      assert.equal(inRequestsToString([
        { user: "alice", requests: 2 }, { user: "bob", requests: 1 },
      ]), "@alice: 2\n@bob: 1\n");
    });
  });
});
