import * as assert from 'assert';
import {describe, it} from 'mocha';

import InRequest from "../../../src/domain/inRequest";
import SimpleUser from "../../../src/domain/simpleUser";
import UniqueEntityID from "../../../src/domain/core/uniqueEntityId";

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
    const r = InRequest.create(u, date);
    assert.deepEqual(date, r.formattedDate);
  });

  it('Invalid date throws Error', () =>
    assert.throws(() => {
      const date = "2021/12/20 12:12:12";
      InRequest.create(u, date);
    }));

});
