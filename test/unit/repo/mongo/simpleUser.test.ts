import {describe, it} from 'mocha';
import randomstring from 'randomstring';

import DbConnector from "../../../../src/persistence/repos/dbConnector";
import SimpleUserMongoDb from "../../../../src/persistence/repos/mongodb/simpleUser.mongo.repo";
import SimpleUserDataModel from "../../../../src/persistence/dataModel/simpleUser.dataModel";
import UniqueEntityID from "../../../../src/domain/core/uniqueEntityId";

describe('[Unit] SimpleUserMongoRepo class + DB server', function () {
  this.timeout(20000);

  const repo = new SimpleUserMongoDb();
  const dataModel = {
    domainId: new UniqueEntityID().toString(),
    id: Math.floor(Math.random() * 10000000000),
    username: randomstring.generate()
  } as SimpleUserDataModel;

  it('Create user', async (done) => {
    await DbConnector.getInstance().connect(true);
    console.log('connected');

    await repo.save(dataModel);

    // await new Promise(r => setTimeout(r, 3000));
    console.log(await repo.getByDomainId(dataModel.domainId));
    // done()
  });

});
