import {describe, it} from 'mocha';
import * as assert from 'assert';
import moment from "moment";

import config from "../../../../src/config";
import InRequestMongoDb from "../../../../src/persistence/repos/mongodb/inRequest.mongo.repo";
import UniqueEntityID from "../../../../src/domain/core/uniqueEntityId";
import InRequest from "../../../../src/domain/inRequest";
import InRequestDataModel from "../../../../src/persistence/dataModel/inRequest.dataModel";
import DbConnector from "../../../../src/persistence/repos/dbConnector";

describe('[Unit] InRequestMongoRepo class + DB server', () => {
  if (config.dbType !== 'mongodb') return;

  const repo = new InRequestMongoDb();
  const dataModel = {
    domainId: new UniqueEntityID().toString(),
    user: new UniqueEntityID().toString(),
    date: moment(moment.now(), true).valueOf()
  } as InRequestDataModel;
  const {domainId, user, date} = dataModel;

  before(() => DbConnector.getInstance().connect(true));

  it('Create in-request success', async () => {
    const persisted = await repo.newRequest(domainId, user);
    assert.equal(persisted.domainId, domainId);
    assert.equal(persisted.user, user);
    assert.ok(InRequest.dateEquals(persisted.date, moment().valueOf()));
  });

  it('Create in-request fail (domainId already exists', async () => {
    try {
      await repo.newRequest(domainId, new UniqueEntityID().toString());
      assert.fail('Should throw an exception');
    } catch (e) {
      assert.equal(e.name, 'MongoServerError');
    }
  });

  const compareDataModels = (dm1: InRequestDataModel) =>
    dm1.domainId === domainId && dm1.user === user && InRequest.dateEquals(dm1.date, moment().valueOf());

  it('Requests since last 3 seconds contains the added data model', async () => {
    const last3seconds = new Date();
    last3seconds.setSeconds(last3seconds.getSeconds() - 3);

    const res = await repo.requestsSince(last3seconds.valueOf());
    assert.equal(res.length, 1);
    assert.ok(res.find((v) => compareDataModels(v)));
  });

  it('Requests in the last month contains the added date', async () => {
    const res = await repo.requestsLastMonth();
    assert.ok(res.find((v) => compareDataModels(v)));
  });

  it('Requests in the last 15 days contains the added date', async () => {
    const res = await repo.requestsLast15Days();
    assert.ok(res.find((v) => compareDataModels(v)));
  });

});
