export interface InfosForText {
  telegram: string;
  signal: string,
  date: string;
  descr1: string;
  descr2?: string;
}

export interface Convo {
  command: string;
  data: {
    audio: boolean;
    text?: InfosForText
  };
}

export interface ConvoMemory {
  [k: string]: Convo;
}
