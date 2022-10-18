import {describe, it} from 'mocha';
import * as assert from 'assert';
import * as r from 'randomstring';
import * as fs from "fs";

import FileMongoRepo from "../../../../src/persistence/repos/mongodb/fileMongoRepo";
import FileDataModel from "../../../../src/persistence/dataModel/file.dataModel";
import UniqueEntityID from "../../../../src/domain/core/uniqueEntityId";
import DbConnector from "../../../../src/persistence/repos/dbConnector";

describe('[Unit] FileMongoRepo + MongoDB server', () => {

  const repo = new FileMongoRepo();
  const dataModel: FileDataModel = {
    type: 'image',
    domainId: new UniqueEntityID().toString(),
    fileId: r.generate(),
    file: fs.readFileSync(`${__dirname}/rapaz.jpg`)
  }
  const {type, domainId, fileId, file} = dataModel;
  fs.writeFileSync(`${__dirname}/original${fileId}.png`, file)

  before(() => DbConnector.getInstance().connect(true));

  it('save image', async () => {
    const ret = await repo.save(dataModel);
    fs.writeFileSync(`${__dirname}/saved${fileId}.png`, ret.file);
  })

  it('get the image by fileId', async () => {
    const ret = await repo.getById(fileId);
    assert.ok(ret);
    assert.ok(ret.file)
    fs.writeFileSync(`${__dirname}/byID${fileId}.png`, ret.file);
  })

  it('delete', async () => {
    const ret = await repo.remove(fileId);
    assert.ok(ret);
    assert.ok(ret.file);
    const get = await repo.getById(fileId);
    assert.equal(get, undefined);
  })

})
