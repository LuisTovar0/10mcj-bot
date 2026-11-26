import { createCanvas } from "canvas";
import { afterEach, beforeEach, describe, it } from "mocha";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Browser, type BrowserType, chromium } from "playwright";
import AiThumbnailService, { selectThumbnailProvider } from "../../../src/service/ai-thumbnail.service";
import ChatGptThumbnailProvider from "../../../src/service/chatgpt-thumbnail.provider";
import { validateThumbnailPng } from "../../../src/service/thumbnail-job";

const title = 'O valor da oração';
const date = '26 novembro 2026';
const session = '__Secure-fixture.0=first=; __Secure-fixture.1=second';
const png = createCanvas(48, 27).toBuffer('image/png');

describe('ChatGPT browser thumbnail jobs', function () {
  this.timeout(15_000);
  let directory: string;
  let jobs: string;
  let browser: Browser | undefined;
  let sessionHeader: string | null;
  let submissions: { prompt: string; images: string[]; effort: string }[];
  let downloads: string[];

  beforeEach(async () => {
    directory = await mkdtemp(resolve('.thumbnail-browser-test-'));
    jobs = join(directory, 'jobs');
    const examples = join(directory, 'thumbnail-examples');
    await mkdir(examples);
    await mkdir(jobs);
    await writeFile(join(examples, 'second.png'), png);
    await writeFile(join(examples, 'first.jpg'), createCanvas(48, 27).toBuffer('image/jpeg'));
    browser = undefined;
    sessionHeader = null;
    submissions = [];
    downloads = [];
  });

  afterEach(async () => {
    await browser?.close();
    await rm(directory, { recursive: true, force: true });
  });

  function fixture({ mode = 'ready', image = png, status = 200, headers = {} } = {}): BrowserType['launch'] {
    return async options => {
      const instance = await chromium.launch(options);
      browser = instance;
      const newContext = instance.newContext.bind(instance);
      instance.newContext = async contextOptions => {
        const context = await newContext(contextOptions);
        await context.route('**/*', async route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== 'https://chatgpt.com') return route.abort();
          switch (url.pathname) {
            case '/':
              sessionHeader = await request.headerValue('cookie');
              return route.fulfill({
                status, headers, contentType: 'text/html', body: fixturePage(mode, image),
              });
            case '/submitted':
              submissions.push(request.postDataJSON());
              return route.fulfill({ status: 204 });
            case '/clicked':
              downloads.push(request.postData()!);
              return route.fulfill({ status: 204 });
            default:
              return route.abort();
          }
        });
        return context;
      };
      return instance;
    };
  }

  function job(launch: BrowserType['launch'], timeoutMs?: number) {
    const provider = new ChatGptThumbnailProvider(session, launch);
    const service = new AiThumbnailService(provider, { files: directory, temp: jobs, timeoutMs });
    const started = service.start({ title, date, async acknowledge() {}, async background() { return png; } });
    assert.equal(started.status, 'started');
    return started.result;
  }

  async function assertClean() {
    assert.equal(browser?.isConnected(), false);
    assert.deepEqual(await readdir(jobs), []);
  }

  it('selects the configured provider and validates only its credentials', () => {
    assert.equal(selectThumbnailProvider({ CHATGPT_SESSION_COOKIE: session }).state, 'disabled');
    assert.equal(selectThumbnailProvider({ AI_THUMBNAIL_PROVIDER: 'chatgpt-web', CHATGPT_SESSION_COOKIE: session,
      CODEX_AUTH_JSON: 'broken', CODEX_API_KEY: 'fixture-ignored',
    }).state, 'enabled');
    assert.equal(selectThumbnailProvider({ AI_THUMBNAIL_PROVIDER: 'chatgpt-web' }).state, 'disabled');
    assert.equal(selectThumbnailProvider({
      AI_THUMBNAIL_PROVIDER: 'chatgpt-web', CHATGPT_SESSION_COOKIE: 'value-without-cookie-name',
    }).state, 'misconfigured');
    assert.equal(selectThumbnailProvider({ AI_THUMBNAIL_PROVIDER: 'unknown' }).state, 'misconfigured');
  });

  it('sends the background and every style example separately at High effort', async () => {
    assert.deepEqual(await job(fixture()), { status: 'ready', png, quality: 'unreviewed' });
    assert.equal(sessionHeader, session);
    assert.equal(submissions.length, 1);
    assert.deepEqual(submissions[0].images, [ 'background.png', 'first.jpg', 'second.png' ]);
    assert.equal(submissions[0].effort, 'High');
    assert.ok(submissions[0].prompt.includes(JSON.stringify({ title, date })));
    assert.deepEqual(downloads, [ '/generated' ]);
    await assertClean();
  });

  it('stops before sending when the account cannot select High effort', async () => {
    assert.deepEqual(await job(fixture({ mode: 'locked' })), { status: 'failed' });
    assert.deepEqual(submissions, []);
    await assertClean();
  });

  it('normalizes a downloaded JPEG to PNG', async () => {
    const result = await job(fixture({ image: createCanvas(48, 27).toBuffer('image/jpeg') }));
    assert.equal(result.status, 'ready');
    await validateThumbnailPng(result.png);
    await assertClean();
  });

  it('opens the generated image viewer when the reply has no download button', async () => {
    assert.deepEqual(await job(fixture({ mode: 'viewer' })), { status: 'ready', png, quality: 'unreviewed' });
    assert.deepEqual(downloads, [ '/generated' ]);
    await assertClean();
  });

  it('downloads the new image from the current ChatGPT response body and viewer', async () => {
    assert.deepEqual(await job(fixture({ mode: 'current-viewer' })), { status: 'ready', png, quality: 'unreviewed' });
    assert.deepEqual(downloads, [ '/generated' ]);
    await assertClean();
  });

  it('rejects a corrupt download and a portrait image', async () => {
    assert.deepEqual(await job(fixture({ image: png.subarray(0, 33) })), { status: 'failed' });
    await assertClean();
    assert.deepEqual(await job(fixture({ image: createCanvas(27, 48).toBuffer('image/png') })), { status: 'failed' });
    await assertClean();
  });

  for (const { mode, status, headers, reason } of [
    { mode: 'expired', status: 200, reason: 'session-expired' },
    { mode: 'ready', status: 401, reason: 'session-expired' },
    { mode: 'ready', status: 403, headers: { 'cf-mitigated': 'challenge' }, reason: 'verification-required' },
    { mode: 'verification-title', status: 200, reason: 'verification-required' },
    { mode: 'ready', status: 403, reason: 'access-denied' },
  ]) {
    it(`reports ${ reason } for HTTP ${ status } and stops before upload`, async () => {
      const lines: string[] = [];
      const { info, warn } = console;
      try {
        console.info = console.warn = (line: string) => { lines.push(line); };
        assert.deepEqual(await job(fixture({ mode, status, headers })), { status: 'failed' });
      } finally {
        console.info = info;
        console.warn = warn;
      }
      assert.ok(lines.some(line => line.includes('event=sign-in-response') && line.includes(`httpStatus=${ status } `)));
      assert.ok(lines.some(line => line.includes(`reason=${ reason }`)));
      assert.ok(lines.every(line => !line.includes('__Secure-fixture')));
      assert.deepEqual(submissions, []);
      assert.deepEqual(downloads, []);
      await assertClean();
    });
  }

  it('closes Chromium when the reply times out', async () => {
    assert.deepEqual(await job(fixture({ mode: 'hang' }), 7_000), { status: 'failed' });
    assert.equal(submissions.length, 1);
    assert.deepEqual(downloads, []);
    await assertClean();
  });
});

function fixturePage(mode: string, image: Buffer): string {
  if (mode === 'expired') return '<button>Log in</button><textarea id="prompt-textarea"></textarea>';
  if (mode === 'verification-title') return '<title>Just a moment…</title>';
  return `
    <button aria-label="Open profile menu">Profile</button>
    <article data-testid="conversation-turn-1">
      <div data-message-author-role="assistant"><a download data-image="/stale">Download image</a></div>
    </article>
    <article data-testid="conversation-turn-2">
      <div data-message-author-role="user"><a download data-image="/reference">Download image</a></div>
    </article>
    <div data-turn-key="old"><div data-response-body><a download data-image="/stale">Download image</a></div></div>
    <form>
      <button type="button" aria-label="Select ChatGPT model">Thinking effort</button>
      <input type="file" multiple hidden>
      ${ mode === 'viewer' ? '<textarea id="prompt-textarea"></textarea>' : '<div class="ProseMirror" role="textbox" contenteditable="true"></div>' }
      ${ mode === 'viewer' ? '<button type="submit" data-testid="send-button">Send prompt</button>' : '<button type="submit" aria-label="Send"></button>' }
    </form>
    <div role="menu" aria-label="Select ChatGPT model" hidden>
      <div role="menuitem" aria-label="Select model"><span></span></div>
      <div role="menuitem" aria-label="Power" tabindex="0"><span data-locked="${ mode === 'locked' }"></span></div>
    </div>
    <script>
      const menu = document.querySelector('[role="menu"]');
      const level = menu.querySelector('[aria-label="Select model"] span');
      const levels = ['Low', 'Medium', 'High', 'Extra High'];
      level.textContent = ${ JSON.stringify(mode === 'viewer' ? 'High' : mode === 'current-viewer' ? 'Extra High' : 'Low') };
      document.querySelector('button[aria-label="Select ChatGPT model"]').onclick = () => { menu.hidden = false; };
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') menu.hidden = true;
        if (event.target.getAttribute('aria-label') !== 'Power' || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        const offset = event.key === 'ArrowLeft' ? -1 : 1;
        level.textContent = levels[levels.indexOf(level.textContent) + offset] ?? level.textContent;
      });
      const files = document.querySelector('input[type="file"]');
      files.onchange = () => {
        for (const file of files.files) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.setAttribute('aria-label', 'Remove ' + file.name);
          files.form.append(remove);
        }
      };
      function prepareDownload(link) {
        const data = Uint8Array.from(atob(${ JSON.stringify(image.toString('base64')) }), char => char.charCodeAt(0));
        link.href = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
        link.onclick = () => fetch('/clicked', { method: 'POST', body: link.dataset.image });
      }
      document.querySelectorAll('[data-image]').forEach(prepareDownload);
      document.querySelector('form').onsubmit = async event => {
        event.preventDefault();
        const composer = event.target.querySelector('[contenteditable], textarea');
        await fetch('/submitted', { method: 'POST', body: JSON.stringify({
          prompt: composer.isContentEditable ? composer.innerText : composer.value,
          images: Array.from(files.files, file => file.name), effort: level.textContent
        }) });
        if (${ JSON.stringify(mode) } === 'hang') return;
        const currentViewer = ${ JSON.stringify(mode === 'current-viewer') };
        const reply = document.createElement(currentViewer ? 'div' : 'article');
        if (currentViewer) {
          reply.dataset.turnKey = 'new';
          reply.innerHTML = '<div data-response-body></div>';
        } else {
          reply.dataset.testid = 'conversation-turn-3';
          reply.innerHTML = '<div data-message-author-role="assistant"></div>';
        }
        document.body.append(reply);
        const message = reply.firstElementChild;
        if (currentViewer || ${ JSON.stringify(mode === 'viewer') }) {
          message.innerHTML = currentViewer
              ? '<button data-testid="generated-image-preview" aria-label="Generated image 1">Open</button>'
              : '<button><img alt="Generated image" width="30" height="30"></button>';
          message.querySelector('button').onclick = () => {
            const viewer = document.createElement('dialog');
            viewer.innerHTML = '<a download data-image="/generated">Download</a>';
            document.body.append(viewer);
            prepareDownload(viewer.querySelector('a'));
            viewer.showModal();
          };
        } else {
          message.innerHTML = '<a download data-image="/generated">Download image</a>';
          prepareDownload(message.querySelector('a'));
        }
      };
    </script>`;
}
