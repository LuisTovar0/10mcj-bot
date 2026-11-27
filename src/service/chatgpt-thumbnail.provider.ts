import { imageSize } from "image-size";
import type { BrowserType, Locator, Page } from "playwright";
import type { AiThumbnailProvider, ThumbnailImage, ThumbnailLog, ThumbnailProviderRequest, ThumbnailState } from "./i-service/i-ai-thumbnail.provider";
import {
  matchingSampleNumbers, maxPhotoBytes, pngSignature, readRegularFile, ThumbnailError, type ThumbnailFailure, thumbnailLog,
  thumbnailStylePrompt, thumbnailTextPrompt, validateThumbnailDimensions, validateThumbnailPng,
} from "./thumbnail-job";

const chatGptUrl = 'https://chatgpt.com/';
const actionTimeoutMs = 30_000;
const cookiePair = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+)=([\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+)$/;

interface SessionCookie {
  name: string;
  value: string;
}

export default class ChatGptThumbnailProvider implements AiThumbnailProvider {
  readonly state: ThumbnailState;
  private readonly cookies: SessionCookie[];

  constructor(secret?: string, private readonly launch: BrowserType['launch'] = launchChromium) {
    this.cookies = parseSessionCookies(secret);
    this.state = this.cookies.length ? 'enabled' : secret?.trim() ? 'misconfigured' : 'disabled';
    thumbnailLog('configuration', { provider: 'chatgpt-web', state: this.state,
      reason: this.state === 'misconfigured' ? 'invalid-session-cookie' : undefined,
    }, this.state === 'misconfigured' ? 'warn' : 'info');
  }

  async generate(request: ThumbnailProviderRequest, signal: AbortSignal): Promise<ThumbnailImage> {
    if (this.state !== 'enabled') throw new ThumbnailError('configuration');
    let stage = 'browser-launch';
    const beginStage = (next: string) => {
      stage = next;
      request.log('stage-start', { provider: 'chatgpt-web', stage });
    };
    beginStage(stage);
    const browser = await this.launch({
      headless: true, timeout: actionTimeoutMs, downloadsPath: request.directory,
      env: { PATH: process.env.PATH, LANG: 'C.UTF-8' },
    }).catch(() => {
      signal.throwIfAborted();
      throw new ThumbnailError('browser', 'browser-launch');
    });
    let closing: Promise<void> | undefined;
    const closeBrowser = () => {
      closing ??= browser.close().catch(() => {
        request.log('stage-failed', { stage: 'browser-close', failure: 'cleanup' }, 'warn');
      });
      return closing;
    };
    signal.addEventListener('abort', closeBrowser, { once: true });
    try {
      signal.throwIfAborted();
      beginStage('sign-in');
      const context = await browser.newContext({ locale: 'en-US', acceptDownloads: true });
      context.setDefaultTimeout(actionTimeoutMs);
      await context.addCookies(this.cookies.map(cookie => ({
        ...cookie, url: chatGptUrl, httpOnly: true, secure: true, sameSite: 'Lax',
      })));
      const page = await context.newPage();
      const composer = await signedInComposer(page, request.log);
      const form = page.locator('form').filter({ has: composer });

      beginStage('high-effort');
      await selectHighEffort(page, form);
      beginStage('upload');
      const attachments = [ request.backgroundPath, ...request.referencePaths ];
      if (request.guidePath) attachments.push(request.guidePath);
      await uploadImages(page, form, attachments);
      const lastAttachment = page.getByRole('button', { name: /^Remove /i }).nth(attachments.length - 1);
      const readyForm = form.filter({ has: lastAttachment });
      await readyForm.waitFor({ state: 'visible' });
      await composer.fill([
        'Create one opaque landscape YouTube thumbnail for a Portuguese meditation. Use a 16:9 composition.',
        `Use the first attachment as the background. The next ${ request.referencePaths.length } attachments are samples numbered from 1. Choose the closest layout from sample numbers ${ matchingSampleNumbers(request).join(', ') } and match its typography, date treatment and branding.`,
        thumbnailStylePrompt(request),
        thumbnailTextPrompt(request),
      ].join('\n\n'));

      beginStage('generation');
      const turns = page.locator('[data-testid^="conversation-turn-"], article[data-turn]').filter({
        has: page.locator('[data-message-author-role="assistant"]'),
      }).or(page.locator('[data-turn-key] [data-response-body]'));
      const reply = turns.nth(await turns.count());
      await readyForm.getByRole('button', { name: /^Send(?: prompt)?$/i }).or(readyForm.getByTestId('send-button'))
          .filter({ visible: true }).first().click();

      const imageAction = await findDownload(page, reply);

      beginStage('download');
      const [ download ] = await Promise.all([
        page.waitForEvent('download'), imageAction.click(),
      ]);
      const bytes = await readRegularFile(await download.path(), maxPhotoBytes).catch(() => {
        throw new ThumbnailError('artifact', 'invalid-download');
      });

      beginStage('validation');
      const png = bytes.subarray(0, 8).equals(pngSignature) ? bytes : await normalizeRaster(bytes, await context.newPage());
      await validateThumbnailPng(png);
      signal.throwIfAborted();
      return { png, quality: 'unreviewed' };
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof ThumbnailError) throw error;
      const failure: ThumbnailFailure = stage === 'sign-in' ? 'configuration' : 'browser';
      throw new ThumbnailError(failure, stage === 'sign-in' ? 'sign-in-unavailable' : stage);
    } finally {
      signal.removeEventListener('abort', closeBrowser);
      await closeBrowser();
    }
  }
}

const launchChromium: BrowserType['launch'] = async options => (await import('playwright')).chromium.launch(options);

function parseSessionCookies(secret?: string): SessionCookie[] {
  if (!secret?.trim()) return [];
  const cookies = new Map<string, string>();
  for (const part of secret.split(';')) {
    const pair = cookiePair.exec(part.trim());
    if (!pair || cookies.has(pair[1])) return [];
    cookies.set(pair[1], pair[2]);
  }
  return Array.from(cookies, ([ name, value ]) => ({ name, value }));
}

async function signedInComposer(page: Page, log: ThumbnailLog) {
  const response = await page.goto(chatGptUrl, { waitUntil: 'domcontentloaded' });
  const httpStatus = response?.status();
  const challenge = response?.headers()['cf-mitigated'] === 'challenge'
      || /just a moment|verify you are human/i.test(await page.title());
  log('sign-in-response', { provider: 'chatgpt-web', httpStatus, challenge });
  if (challenge) throw new ThumbnailError('configuration', 'verification-required');

  const url = new URL(page.url());
  if (httpStatus === 401 || url.origin !== new URL(chatGptUrl).origin || url.pathname.startsWith('/auth/'))
    throw new ThumbnailError('configuration', 'session-expired');
  if (httpStatus === 403) throw new ThumbnailError('configuration', 'access-denied');
  if (httpStatus !== undefined && httpStatus >= 400) throw new ThumbnailError('browser', 'sign-in-http-error');

  const profile = page.getByTestId('profile-button').or(page.getByTestId('accounts-profile-button'))
      .or(page.getByRole('button', { name: /^open profile menu/i }));
  const login = page.getByRole('button', { name: 'Log in', exact: true })
      .or(page.getByRole('link', { name: 'Log in', exact: true }));
  await profile.or(login).first().waitFor({ state: 'visible' });
  if (await login.first().isVisible() && !await profile.first().isVisible())
    throw new ThumbnailError('configuration', 'session-expired');
  const composer = page.locator('div.ProseMirror[role="textbox"], #prompt-textarea').filter({ visible: true }).first();
  await composer.waitFor({ state: 'visible' });
  return composer;
}

async function selectHighEffort(page: Page, form: Locator): Promise<void> {
  const name = 'Select ChatGPT model';
  await form.getByRole('button', { name, exact: true }).click();
  const menu = page.getByRole('menu', { name, exact: true });
  const effort = menu.getByRole('menuitem', { name: 'Select model', exact: true });
  const power = menu.getByRole('menuitem', { name: 'Power', exact: true });
  // The picker exposes its current level as text and adjusts Power with the arrow keys.
  for (let adjustment = 0; adjustment < 2; adjustment++) {
    const level = (await effort.innerText()).trim();
    if (level === 'High') break;
    if (!['Low', 'Medium', 'Extra High'].includes(level) || await power.locator('[data-locked="true"]').count())
      throw new ThumbnailError('configuration', 'high-effort-unavailable');
    await power.press(level === 'Extra High' ? 'ArrowLeft' : 'ArrowRight');
    await effort.getByText(level, { exact: true }).waitFor({ state: 'hidden' });
  }
  if ((await effort.innerText()).trim() !== 'High') throw new ThumbnailError('configuration', 'high-effort-unavailable');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
}

async function uploadImages(page: Page, form: Locator, images: string[]): Promise<void> {
  const input = form.locator('input[type="file"][multiple]:not([webkitdirectory])').first();
  if (await input.count()) {
    await input.setInputFiles(images);
    return;
  }
  await page.getByTestId('composer-plus-btn').or(page.getByRole('button', { name: /add files and more/i })).first().click();
  const upload = page.getByRole('menuitem', { name: /add photos (?:and|&) files|upload from computer/i });
  const [ chooser ] = await Promise.all([ page.waitForEvent('filechooser'), upload.click() ]);
  await chooser.setFiles(images);
}

function imageDownload(scope: Locator): Locator {
  const name = /^(?:save|download)(?: (?:this |the )?image)?$/i;
  return scope.getByRole('button', { name })
      .or(scope.getByTestId('download-generated-image'))
      .or(scope.getByRole('link', { name }));
}

async function findDownload(page: Page, reply: Locator): Promise<Locator> {
  const inline = imageDownload(reply).filter({ visible: true });
  const preview = reply.getByTestId('generated-image-preview')
      .or(reply.getByRole('img', { name: /generated image|image generated/i })).filter({ visible: true });
  await inline.or(preview).first().waitFor({ state: 'visible', timeout: 0 });
  if (await inline.first().isVisible()) return inline.first();

  await preview.first().click();
  return imageDownload(page.getByRole('dialog')).filter({ visible: true }).first();
}

async function normalizeRaster(bytes: Buffer, page: Page): Promise<Buffer> {
  try {
    const { width, height, type } = imageSize(bytes);
    if (type !== 'jpg' && type !== 'webp') throw new ThumbnailError('artifact', 'unsupported-image-format');
    validateThumbnailDimensions(width, height);
    // This expression runs in a blank Chromium page. The Bun project has no DOM globals.
    const png = await page.evaluate<string>(`(async () => {
      const data = Uint8Array.from(atob(${ JSON.stringify(bytes.toString('base64')) }), char => char.charCodeAt(0));
      const image = await createImageBitmap(new Blob([data], { type: '${ type === 'jpg' ? 'image/jpeg' : 'image/webp' }' }),
          { imageOrientation: 'none' });
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      image.close();
      return canvas.toDataURL('image/png').split(',')[1];
    })()`);
    return Buffer.from(png, 'base64');
  } catch (error) {
    if (error instanceof ThumbnailError) throw error;
    throw new ThumbnailError('artifact', 'unreadable-download');
  }
}
