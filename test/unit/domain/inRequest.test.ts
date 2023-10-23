import * as assert from 'assert';
import { describe, it } from 'mocha';
import moment from 'moment';

import InRequest from "../../../src/domain/in-request";
import SimpleUser from "../../../src/domain/simple-user";
import UniqueEntityID from "../../../src/domain/core/unique-entity-id";

describe('[Unit] InRequest class', () => {

  const uDomainId = new UniqueEntityID();
  const uProps = {
    id: 100000,
    firstname: "Luís",
    lastname: "Maria",
    username: "tovarzinho"
  };
  const u = new SimpleUser(uProps, uDomainId);

  it('Valid constructor', () => {
    const date = "20211220 12:12:12";
    const r = InRequest.create(u, moment(date, InRequest.dateFormat, true).valueOf());
    assert.deepEqual(date, r.formattedDate);
  });

});
