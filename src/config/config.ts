import dotenv from "dotenv";
import {repoDeps} from "./db";
import {Dep} from "../loaders";

if (!dotenv.config()) throw '\u{26A0} Could not find .env file! \u{26A0}';
const envs = loadEnvVars({runningEnv: '', dbType: ''});

const config = {

  ...envs,

  deps: {
    repo: repoDeps(envs.dbType),
    service: {
      imageEditing: {
        name: 'CanvasService',
        path: './service/canvas.service'
        //name: 'PixoEditorService',
        //path: './service/pixoEditor.service'
      } as Dep,
      simpleUser: {
        name: 'SimpleUserService',
        path: './service/simpleUser.service',
      } as Dep,
      inRequest: {
        name: 'InRequestService',
        path: './service/inRequest.service'
      } as Dep,
      botUtils: {
        name: 'BotUtilsServive',
        path: './service/telegramBot/botUtils.service'
      },
      textFormatting: {
        name: 'TextFormattingService',
        path: './service/telegramBot/textFormatting.service'
      } as Dep,
      convoMemory: {
        name: 'LocalConvoMemoryService',
        path: './service/telegramBot/localConvoMemory.service'
      } as Dep,
      lists: {
        name: 'WhitelistService',
        path: './service/telegramBot/commands/lists.service'
      } as Dep,
      pt: {
        name: 'PtService',
        path: './service/telegramBot/commands/pt.service'
      } as Dep,
      bot: {
        name: 'BotService',
        path: './service/telegramBot/bot.service'
      } as Dep
    },
  }
};

export default config;

export type Envs = { [k: string]: string; };

export function loadEnvVar(camelCaseName: string) {
  const envVarName = camelCaseToMacroCase(camelCaseName);
  const env = process.env[envVarName];
  if (!env) throw new Error(`${envVarName} environment variable is not defined.`);
  return env;
}

export function loadEnvVars<T extends Envs>(emptyEnvs: T): T {
  const b = emptyEnvs;
  Object.keys(b).forEach(v => {
    // @ts-ignore
    b[v] = loadEnvVar(v);
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
