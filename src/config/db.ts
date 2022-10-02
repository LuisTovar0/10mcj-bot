import {Dep} from "../loaders";

export const repoDeps = (dbType: string) => {
  let repoDeps: { simpleUser: Dep, inRequest: Dep };
  switch (dbType) {
    case 'local':
      repoDeps = {
        simpleUser: {
          name: 'SimpleUserLocalRepo',
          path: './persistence/repos/local/simpleUser.local.repo'
        },
        inRequest: {
          name: 'InRequestLocalRepo',
          path: './persistence/repos/local/inRequest.local.repo'
        }
      };
      break;
    case 'mongodb':
      repoDeps = {
        inRequest: {
          name: 'InRequestMongoDb',
          path: './persistence/repos/mongodb/inRequest.mongo.repo'
        },
        simpleUser: {
          name: 'SimpleUserMongoDb',
          path: './persistence/repos/mongodb/simpleUser.mongo.repo'
        }
      };
      break;
    default:
      throw new Error(`DB_TYPE ${dbType} is invalid.`);
  }
  return repoDeps;
};