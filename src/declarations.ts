import fs from "fs";

export interface Memory {
  [k: string]: {
    command: string,
    data: {
      audio: boolean,
      text: {
        telegram?: string,
        signal?: string,
        date?: string,
        descr?: string
      }
    }
  };
}

export interface Msg {
  chat: {
    id: string,
    user: { name: string };
  },
  text: string,
  file: any
}

export interface Reply {
  audio: (arg0: fs.ReadStream, arg1: number, artist: string, title: string, message: string, parse_mode: string) => void;
  text: (arg0: string) => any;
  html: (arg0: string) => void;
  sendGeneric: (arg0: string, arg1: { text: string; parse_mode?: string; disable_web_page_preview?: boolean; }) => void;
}

export interface Bot {
  fileLoad: (arg0: any, arg1: (err: any, buffer: any) => void) => void;
}