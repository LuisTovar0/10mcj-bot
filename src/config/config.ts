import dotenv from "dotenv";
import {Dep} from "../loaders";
import {camelCaseToMacroCase, repoDeps} from "./db";

if (!dotenv.config()) throw '\u{26A0} Could not find .env file! \u{26A0}';
const envs = loadEnvVars({ runningEnv: '', dbType: '' });

const config = {

  ...envs,

  deps: {
    repo: repoDeps(envs.dbType),
    service: {
      image: {
        name: 'ImageService',
        path: './service/image.service',
      } as Dep,
      imageEditing: {
        name: 'CanvasService',
        path: './service/canvas.service',
      } as Dep,
      simpleUser: {
        name: 'SimpleUserService',
        path: './service/simple-user.service',
      } as Dep,
      inRequest: {
        name: 'InRequestService',
        path: './service/in-request.service',
      } as Dep,
      botUtils: {
        name: 'BotUtilsServive',
        path: './service/telegram-bot/bot-utils.service',
      },
      convoMemory: {
        name: 'LocalConvoMemoryService',
        path: './service/telegram-bot/local-convo-memory.service',
      } as Dep,
      lists: {
        name: 'WhitelistService',
        path: './service/telegram-bot/commands/lists.service',
      } as Dep,
      pt: {
        name: 'PtService',
        path: './service/telegram-bot/commands/pt.service',
      } as Dep,
      video: {
        name: 'ShotstackService',
        path: './service/shotstack.service',
      } as Dep,
      imageCommands: {
        name: 'ImageCommands',
        path: './service/telegram-bot/commands/image.commands',
      } as Dep,
      bot: {
        name: 'BotService',
        path: './service/telegram-bot/bot.service',
      } as Dep,
    },
  },
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

