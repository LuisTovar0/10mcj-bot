import {before, describe} from 'mocha';
import * as assert from 'assert';
import * as randStr from 'randomstring';
import * as fs from "fs";

import FileMongoRepo from "../../../../src/persistence/repos/mongodb/file.mongo.repo";
import ImageMongoRepo from "../../../../src/persistence/repos/mongodb/image.mongo.repo";
import DbConnector from "../../../../src/persistence/repos/dbConnector";
import ImageDto from "../../../../src/dto/image.dto";
import UniqueEntityID from "../../../../src/domain/core/uniqueEntityId";

describe('[Integration] ImageMongoRepo + FileMongoRepo + MongoDB server', function () {
  this.timeout(5000);

  const fileRepo = new FileMongoRepo();
  const repo = new ImageMongoRepo(fileRepo);
  const dto: ImageDto = {
    domainId: new UniqueEntityID().toString(),
    offset: 600,
    file: {
      domainId: new UniqueEntityID().toString(),
      id: randStr.generate(),
      file: fs.readFileSync(`./test/rapaz.jpg`)
    }
  };

  before(() => DbConnector.getInstance().connect(true));

  it('save image', async () => {
    const ret = await repo.save(dto);
    const fileName = `${__dirname}/saved${dto.domainId}.png`;
    fs.writeFileSync(fileName, ret.file.file);
    fs.rmSync(fileName);
  });

  it('get the image by fileId', async () => {
    const ret = await repo.getById(dto.file.id);
    assert.ok(ret);
    assert.ok(ret.file.file);
    const fileName = `${__dirname}/byID${dto.domainId}.png`;
    fs.writeFileSync(fileName, ret.file.file);
    fs.rmSync(fileName);
  });

  it('get the image by domainId', async () => {
    const ret = await repo.getByDomainId(dto.domainId);
    assert.ok(ret);
    assert.ok(ret.file.file);
    const fileName = `${__dirname}/byDomainID${dto.domainId}.png`;
    fs.writeFileSync(fileName, ret.file.file);
    fs.rmSync(fileName);
  });

  it('delete image', async () => {
    const ret = await repo.remove(dto.file.id);
    assert.ok(ret);
    assert.ok(ret.file);
    assert.ok(ret.file.file);
    const get = await repo.getById(dto.file.id);
    assert.equal(get, null);
  });

});
