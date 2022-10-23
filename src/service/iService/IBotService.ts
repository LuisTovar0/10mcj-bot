export default interface IBotService {
  token: string;
  run(): Promise<void>;
}
