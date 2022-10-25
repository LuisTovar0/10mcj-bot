import {describe, it} from 'mocha';
import * as assert from 'assert';
import * as randStr from 'randomstring';
import * as fs from "fs";

import FileMongoRepo from "../../../../src/persistence/repos/mongodb/file.mongo.repo";
import FileDataModel from "../../../../src/persistence/dataModel/file.dataModel";
import UniqueEntityID from "../../../../src/domain/core/uniqueEntityId";
import DbConnector from "../../../../src/persistence/repos/dbConnector";

describe('[Unit] FileMongoRepo + MongoDB server', () => {

  const repo = new FileMongoRepo();
  const dataModel: FileDataModel = {
    domainId: new UniqueEntityID().toString(),
    id: randStr.generate(),
    file: fs.readFileSync(`./test/rapaz.jpg`)
  };
  const {domainId, id} = dataModel;

  before(() => DbConnector.getInstance().connect(true));

  it('save file', async () => {
    const ret = await repo.save(dataModel);
    const fileName = `${__dirname}/saved${id}.png`;
    fs.writeFileSync(fileName, ret.file);
    fs.rmSync(fileName);
  });

  it('get the file by fileId', async () => {
    const ret = await repo.getById(id);
    assert.ok(ret);
    assert.ok(ret.file);
    const fileName = `${__dirname}/byID${id}.png`;
    fs.writeFileSync(fileName, ret.file);
    fs.rmSync(fileName);
  });

  it('get the file by domainId', async () => {
    const ret = await repo.getByDomainId(domainId);
    assert.ok(ret);
    assert.ok(ret.file);
    const fileName = `${__dirname}/byDomainID${id}.png`;
    fs.writeFileSync(fileName, ret.file);
    fs.rmSync(fileName);
  });

  it('delete file', async () => {
    const ret = await repo.remove(id);
    assert.ok(ret);
    assert.ok(ret.file);
    const get = await repo.getById(id);
    assert.equal(get, undefined);
  });

})
