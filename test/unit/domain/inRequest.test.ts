import { describe, it } from "mocha";
import moment from "moment";
import * as assert from "node:assert/strict";

import InRequest from "../../../src/domain/in-request";
import SimpleUser from "../../../src/domain/simple-user";

describe("[Unit] InRequest", () => {
  const user = new SimpleUser({ id: 100000, username: "test-user" }, "user-id");

  it("preserves the user, timestamp and supplied domain ID", () => {
    const timestamp = new Date(2024, 1, 29, 12, 34, 56).valueOf();
    const request = InRequest.create(user, timestamp, "request-id");

    assert.equal(request.user, user);
    assert.equal(request.dateLong, timestamp);
    assert.equal(request.domainId.toString(), "request-id");
    assert.equal(request.formattedDate, "20240229 12:34:56");
  });

  it("accepts a Moment without sharing its mutable date", () => {
    const date = moment([ 2024, 1, 29, 8, 9, 10 ]);
    const request = InRequest.create(user, date);

    date.add(1, "day");

    assert.equal(request.formattedDate, "20240229 08:09:10");
    assert.notEqual(request.moment, date);
  });

  describe("dateEquals", () => {
    const timestamp = 1_700_000_000_000;

    for (const difference of [ 0, 1, 2_999, -1, -2_999 ]) {
      it(`accepts a difference of ${ difference } milliseconds`, () => {
        assert.equal(InRequest.dateEquals(timestamp, timestamp + difference), true);
      });
    }

    for (const difference of [ 3_000, 3_001, -3_000, -3_001 ]) {
      it(`rejects a difference of ${ difference } milliseconds`, () => {
        assert.equal(InRequest.dateEquals(timestamp, timestamp + difference), false);
      });
    }
  });
});
