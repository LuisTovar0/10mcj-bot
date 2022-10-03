import dotenv from "dotenv";
import {repoDeps} from "./db";
import {Dep} from "../loaders";

if (!dotenv.config()) throw '\u{26A0} Could not find .env file! \u{26A0}';
const envs = loadEnvVars({botToken: '', adminChatId: '', runningEnv: '', dbType: ''});

const config = {

  ...envs,

  deps: {
    repo: repoDeps(envs.dbType),
    service: {
      simpleUser: {
        name: 'SimpleUserService',
        path: './service/simpleUser.service',
      } as Dep,
      inRequest: {
        name: 'InRequestService',
        path: './service/inRequest.service'
      } as Dep,
      textFormatting: {
        name: 'TextFormattingService',
        path: './service/textFormatting.service'
      } as Dep
    },
  }
};

console.log(`[conf] \u{2699} bot token: ${config.botToken}
[conf] \u{1F4C7} the admin's chat ID: ${config.adminChatId}`);

export default config;

export type Envs = { [k: string]: string; };

export function loadEnvVars<T extends Envs>(emptyEnvs: T): T {
  const b = emptyEnvs;
  Object.keys(b).forEach(v => {
    const envVarName = camelCaseToMacroCase(v);
    const env = process.env[envVarName];
    if (!env) throw new Error(`${envVarName} environment variable is not defined.`);
    // @ts-ignore
    b[v] = env;
  });
  return b;
}

function camelCaseToMacroCase(str: string): string {
  if (/^[a-z]*[a-zA-Z0-9]$/.test(str)) throw new Error(`\u{1F6AB} ${str} is not a variable name in camel case.`);

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
