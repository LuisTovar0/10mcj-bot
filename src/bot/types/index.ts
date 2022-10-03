export interface IMemory {
  [k: string]: {
    command: string;
    data: {
      audio: boolean;
      text?: {
        telegram: string;
        signal: string,
        date: string;
        descr1: string;
        descr2?: string;
      }
    }
  };
}
