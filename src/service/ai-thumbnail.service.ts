import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Service } from "typedi";
import { filesFolder, tempFolder } from "../config/constants";
import ChatGptThumbnailProvider from "./chatgpt-thumbnail.provider";
import CodexThumbnailService from "./codex-thumbnail.service";
import type { AiThumbnailProvider, ThumbnailImage, ThumbnailState, ThumbnailText } from "./i-service/i-ai-thumbnail.provider";
import { pngSignature, ThumbnailError, thumbnailLog } from "./thumbnail-job";

const jobTimeoutMs = 8 * 60_000;

interface ThumbnailRequest extends ThumbnailText {
  acknowledge(): Promise<void>;
  background(): Promise<Buffer>;
}

type ThumbnailResult = ({ status: 'ready' } & ThumbnailImage) | { status: 'failed' };
type StartResult = { status: 'started'; result: Promise<ThumbnailResult> }
    | { status: 'busy' | Exclude<ThumbnailState, 'enabled'> };

interface ThumbnailOptions {
  files?: string;
  temp?: string;
  timeoutMs?: number;
}

export function selectThumbnailProvider(env: NodeJS.ProcessEnv = process.env): AiThumbnailProvider {
  switch (env.AI_THUMBNAIL_PROVIDER?.trim() || 'codex') {
    case 'codex':
      return new CodexThumbnailService({ authJson: env.CODEX_AUTH_JSON, apiKey: env.CODEX_API_KEY });
    case 'chatgpt-web':
      return new ChatGptThumbnailProvider(env.CHATGPT_SESSION_COOKIE);
    default:
      thumbnailLog('configuration', { state: 'misconfigured', reason: 'unknown-provider' }, 'warn');
      return { state: 'misconfigured', async generate() { throw new ThumbnailError('configuration'); } };
  }
}

@Service({ factory: () => new AiThumbnailService() })
export default class AiThumbnailService {
  private running = false;

  constructor(private readonly provider = selectThumbnailProvider(), private readonly options: ThumbnailOptions = {}) {}

  get state(): ThumbnailState {
    return this.provider.state;
  }

  start(request: ThumbnailRequest): StartResult {
    if (this.state !== 'enabled') return { status: this.state };
    if (this.running) return { status: 'busy' };
    this.running = true;
    return { status: 'started', result: this.generate(request).finally(() => { this.running = false; }) };
  }

  private async generate(request: ThumbnailRequest): Promise<ThumbnailResult> {
    const started = performance.now();
    const timeoutMs = this.options.timeoutMs ?? jobTimeoutMs;
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(() => controller.abort(new ThumbnailError('timeout')), timeoutMs);
    const jobId = randomUUID();
    const directory = resolve(this.options.temp ?? tempFolder, `new-thumbnail-${ jobId }`);
    const log: typeof thumbnailLog = (event, fields, level) => thumbnailLog(event, { jobId, ...fields }, level);
    let stage = 'acknowledgement';
    let image: ThumbnailImage | undefined;

    log('job-start', { timeoutMs });
    try {
      await beforeDeadline(signal, () => request.acknowledge());
      stage = 'background';
      const photo = await beforeDeadline(signal, () => request.background());
      stage = 'job-files';
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const backgroundPath = join(directory, photo.subarray(0, 8).equals(pngSignature) ? 'background.png' : 'background.jpg');
      const references = await referenceImages(resolve(this.options.files ?? filesFolder, 'thumbnail-examples'));
      await writeFile(backgroundPath, photo);
      signal.throwIfAborted();
      stage = 'provider';
      image = await this.provider.generate({
        title: request.title, date: request.date, directory, backgroundPath, referencePaths: references, log,
      }, signal);
    } catch (error) {
      log('stage-failed', {
        stage, failure: error instanceof ThumbnailError ? error.category : stage,
        reason: error instanceof ThumbnailError ? error.reason : undefined,
      }, 'warn');
    } finally {
      clearTimeout(timer);
      try {
        await rm(directory, { recursive: true, force: true });
      } catch {
        log('stage-failed', { stage: 'cleanup', failure: 'cleanup' }, 'warn');
      }
      const outcome = image?.quality === 'below-target' ? 'fallback' : image?.quality ?? 'failed';
      log('job-finished', { durationMs: Math.round(performance.now() - started), outcome });
    }

    return image ? { status: 'ready', ...image } : { status: 'failed' };
  }
}

async function referenceImages(directory: string): Promise<string[]> {
  let names: string[];
  try {
    names = (await readdir(directory, { withFileTypes: true }))
        .filter(entry => entry.isFile() && /\.(?:jpe?g|png)$/i.test(entry.name)).map(entry => entry.name);
  } catch (error) {
    const reason = error.code === 'ENOENT' ? 'missing-reference-directory' : 'unreadable-reference-directory';
    throw new ThumbnailError('setup', reason);
  }
  if (!names.length) throw new ThumbnailError('setup', 'insufficient-reference-images');
  return names.sort().map(name => join(directory, name));
}

async function beforeDeadline<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  let abort!: () => void;
  const expired = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([ work(), expired ]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
