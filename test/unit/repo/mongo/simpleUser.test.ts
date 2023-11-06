import * as assert from 'assert';
import {describe, it} from 'mocha';
import randomstring from 'randomstring';

import config from "../../../../src/config";
import UniqueEntityID from "../../../../src/domain/core/unique-entity-id";
import SimpleUserDataModel from "../../../../src/persistence/data-model/simple-user.data-model";
import DbConnector from "../../../../src/persistence/repos/db-connector";
import SimpleUserMongoDb from "../../../../src/persistence/repos/mongodb/simple-user.mongo.repo";

describe('[Unit] SimpleUserMongoRepo class + DB server', () => {
  if (config.dbType !== 'mongodb') return;

  const repo = new SimpleUserMongoDb();
  const dataModel = {
    domainId: new UniqueEntityID().toString(),
    id: Math.floor(Math.random() * 10000000000),
    username: randomstring.generate()
  } as SimpleUserDataModel;

  before(async () => await DbConnector.getInstance().connect(true));

  it('Create user success', async () => {
    const persisted = await repo.save(dataModel);
    assert.equal(persisted.domainId, dataModel.domainId);
    assert.equal(persisted.id, dataModel.id);
    assert.equal(persisted.username, dataModel.username);
  });

  it('Create user fail (domainId already exists)', async () => {
    try {
      await repo.save({
        domainId: dataModel.domainId,
        id: Math.floor(Math.random() * 10000000000),
        username: randomstring.generate()
      });
      assert.fail('Should throw an exception');
    } catch (e) {
      assert.equal(e.name, 'MongoServerError');
    }
  });

  it('Create user fail (id already exists)', async () => {
    try {
      await repo.save({
        domainId: new UniqueEntityID().toString(),
        id: dataModel.id,
        username: randomstring.generate()
      });
      assert.fail('Should throw an exception');
    } catch (e) {
      assert.equal(e.name, 'MongoServerError');
    }
  });

  it('Create user fail (username already exists)', async () => {
    try {
      await repo.save({
        domainId: new UniqueEntityID().toString(),
        id: Math.floor(Math.random() * 10000000000),
        username: dataModel.username
      });
      assert.fail('Should throw an exception');
    } catch (e) {
      assert.equal(e.name, 'MongoServerError');
    }
  });

  it('Get user by ID success', async () => {
    const res = await repo.getById(dataModel.id);
    assert.ok(res);
    assert.equal(res.domainId, dataModel.domainId);
    assert.equal(res.id, dataModel.id);
    assert.equal(res.username, dataModel.username);
  });

  it('Get user by ID not found', async () => {
    const res = await repo.getById(Math.floor(Math.random() * 10000000000));
    assert.equal(res, undefined);
  });

  it('Get user by domain ID success', async () => {
    const res = await repo.getByDomainId(dataModel.domainId);
    assert.ok(res);
    assert.equal(res.domainId, dataModel.domainId);
    assert.equal(res.id, dataModel.id);
    assert.equal(res.username, dataModel.username);
  });

  it('Get user by domain ID not found', async () => {
    const res = await repo.getByDomainId(new UniqueEntityID().toString());
    assert.equal(res, null);
  });

  it('Update user success', async () => {
    const chosenPhotoId = randomstring.generate();
    const updated = {
      ...dataModel,
      chosenPhotoId
    } as SimpleUserDataModel;
    await repo.updateUser(updated);

    const res = await repo.getByDomainId(updated.domainId);
    assert.ok(res);
    assert.equal(res.domainId, dataModel.domainId);
    assert.equal(res.id, dataModel.id);
    assert.equal(res.username, dataModel.username);
    assert.equal(res.chosenPhotoId, chosenPhotoId);
  });

  it('Update non existing user', async () => {
    const nonExistingUser = {
      domainId: new UniqueEntityID().toString(),
      id: Math.floor(Math.random() * 10000000000),
      username: randomstring.generate(),
      chosenPhotoId: randomstring.generate()
    } as SimpleUserDataModel;
    await repo.updateUser(nonExistingUser);

    const res = await repo.getByDomainId(nonExistingUser.domainId);
    assert.equal(res, null);
  });

});
