import {before, describe} from 'mocha';
import * as randStr from 'randomstring';
import * as fs from "fs";

import FileMongoRepo from "../../../../src/persistence/repos/mongodb/file.mongo.repo";
import ImageMongoRepo from "../../../../src/persistence/repos/mongodb/image.mongo.repo";
import DbConnector from "../../../../src/persistence/repos/dbConnector";
import ImageDto from "../../../../src/dto/image.dto";
import UniqueEntityID from "../../../../src/domain/core/uniqueEntityId";

describe('[Integration] ImageMongoRepo + FileMongoRepo + MongoDB server', () => {

  const fileRepo = new FileMongoRepo();
  const imageRepo = new ImageMongoRepo(fileRepo);
  const dto: ImageDto = {
    domainId: new UniqueEntityID().toString(),
    offset: 600,
    format: 'png',
    file: {
      domainId: new UniqueEntityID().toString(),
      id: randStr.generate(),
      file: fs.readFileSync(`./test/rapaz.jpg`)
    }
  };

  before(() => DbConnector.getInstance().connect(true));


});
