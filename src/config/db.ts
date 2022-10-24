import {Dep} from "../loaders";

type RepoDep = 'inRequest' | 'simpleUser' | 'whitelist' | 'blacklist' | 'file';
type RepoDeps = {
  [a in RepoDep]?: Dep;
};

export const repoDeps = (dbType: string) => {
  const local: RepoDeps = {
    simpleUser: {
      name: 'SimpleUserLocalRepo',
      path: './persistence/repos/local/simpleUser.local.repo'
    },
    inRequest: {
      name: 'InRequestLocalRepo',
      path: './persistence/repos/local/inRequest.local.repo'
    },
    whitelist: {
      name: 'WhitelistLocalRepo',
      path: './persistence/repos/local/whitelist.local.repo'
    },
    blacklist: {
      name: 'BlacklistLocalRepo',
      path: './persistence/repos/local/blacklist.local.repo'
    }
  };
  const mongodb: RepoDeps = {
    inRequest: {
      name: 'InRequestMongoDb',
      path: './persistence/repos/mongodb/inRequest.mongo.repo'
    },
    simpleUser: {
      name: 'SimpleUserMongoDb',
      path: './persistence/repos/mongodb/simpleUser.mongo.repo'
    },
    whitelist: {
      name: 'WhitelistMongoRepo',
      path: './persistence/repos/mongodb/whitelist.mongo.repo'
    },
    blacklist: {
      name: 'BlacklistMongoRepo',
      path: './persistence/repos/mongodb/blacklist.mongo.repo'
    },
    file: {
      name: 'FileMongoRepo',
      path: './persistence/repos/mongodb/file.mongo.repo'
    }
  };

  function decideDb(depName: RepoDep): Dep {
    const specificDbEnv = `${camelCaseToMacroCase(depName.toLowerCase())}_DBTYPE`;
    const specificDbType = process.env[specificDbEnv];
    if (specificDbType === 'local') {
      const ret = local[depName];
      if (!ret) throw new Error(`${specificDbType} is defined but the repo does not exist`);
      return ret;
    }
    if (specificDbType === 'mongodb' || dbType === 'mongodb') {
      const ret = mongodb[depName];
      if (!ret) throw new Error(`MongoDB repo for ${depName} does not exist.`);
      return ret;
    }
    if (dbType === 'local') {
      const ret = local[depName];
      if (!ret) throw new Error(`Local repo for ${depName} does not exist.`);
      return ret;
    }
    throw new Error('DB_TYPE env var is incorrectly defined.');
  }

  const inRequest = decideDb('inRequest');
  const simpleUser = decideDb('simpleUser');
  const whitelist = decideDb('whitelist');
  const blacklist = decideDb('blacklist');
  const file = decideDb('file');

  return {inRequest, simpleUser, whitelist, blacklist, file};
};

export function camelCaseToMacroCase(str: string): string {
  if (!/[a-z][a-zA-Z0-9]*/.test(str)) throw new Error(`\u{1F6AB} ${str} is not a variable name in camel case.`);

  const sb = [];
  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i);
    if (/^[A-Z]$/.test(char)) // it's an upper case
      sb.push('_' + char);
    else
      sb.push(char.toUpperCase());
  }
  return sb.join('');
}
