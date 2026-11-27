import { createCanvas } from "canvas";
import { afterEach, beforeEach, describe, it } from "mocha";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { separatorColors, type ThumbnailStyle } from "../../../src/domain/thumbnail-style";
import AiThumbnailService from "../../../src/service/ai-thumbnail.service";
import CodexThumbnailService from "../../../src/service/codex-thumbnail.service";

const title = 'A oração: "Confia", com fé';
const date = '25 Novembro 2026';
const good = {
  observedTitle: title, observedDate: date, backgroundFidelity: 4, visualQuality: 4, styleMatch: 4,
  feedback: 'Texto legível',
};
const authJson = '{"auth_mode":"chatgpt","tokens":{"id_token":"test","refresh_token":"test","access_token":"test"}}';

function png(color: string): Buffer {
  const canvas = createCanvas(48, 27);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toBuffer('image/png');
}

describe('Codex thumbnail jobs', function () {
  this.timeout(8_000);
  let directory: string;
  let home: string;
  let temp: string;
  let examples: string;
  let executable: string;
  let passes: { args: string[]; prompt: string; otherSecret: boolean; hasLoginCache: boolean }[];

  beforeEach(async () => {
    directory = await mkdtemp(resolve('.thumbnail-tests-'));
    home = join(directory, 'home');
    temp = join(directory, 'jobs');
    examples = join(directory, 'thumbnail-examples');
    executable = join(directory, 'codex-fixture');
    await mkdir(temp);
    await mkdir(examples);
    await Promise.all([
      writeFile(join(examples, 'pt-260103.png'), png('blue')),
      writeFile(join(examples, 'instructions.jpg'), png('gray')),
      writeFile(join(directory, 'red.png'), png('red')),
      writeFile(join(directory, 'green.png'), png('green')),
      writeFile(join(directory, 'blue.png'), png('blue')),
      writeFile(join(directory, 'invalid.png'), png('black').subarray(0, 33)),
    ]);
    await writeFile(executable, `#!/usr/bin/env bun
const fs = require('node:fs');
const path = require('node:path');
const stamp = ${ JSON.stringify(directory) };
const log = path.join(stamp, 'passes');
const args = process.argv.slice(2);
const count = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trimEnd().split('\\n').length : 0;
const step = JSON.parse(fs.readFileSync(path.join(stamp, 'steps.json'), 'utf8'))[count];
if (step === undefined) process.exit(5);
const prompt = fs.readFileSync(0, 'utf8');
fs.appendFileSync(log, JSON.stringify({ args, prompt,
  otherSecret: !!process.env.CODEX_AUTH_JSON || !!process.env.CODEX_API_KEY || !!process.env.THUMBNAIL_UNRELATED_SECRET,
  hasLoginCache: fs.existsSync(path.join(process.env.CODEX_HOME, 'auth.json')) }) + '\\n');
const thread = '01912345-1234-1234-1234-' + String(count).padStart(12, '0');
console.log(JSON.stringify({ type: 'thread.started', thread_id: thread }));
if (step.error) {
  console.log(JSON.stringify({ type: 'turn.started' }));
  if (step.model) {
    fs.writeSync(2, '2026-11-25T12:00:00Z DEBUG codex_core::session::session: Configuring session: model=' + step.model + '; provider=' + step.error + '\\n');
  }
  if (step.routedModel) {
    const message = 'model rerouted: ' + step.model + ' -> ' + step.routedModel + ' (' + step.error + ')';
    console.log(JSON.stringify({ type: 'item.completed', item: { type: 'error', message } }));
  }
  console.log(JSON.stringify({ type: 'turn.failed', error: { message: step.error } }));
  fs.writeSync(2, step.stderr + '\\n');
  process.exit(1);
}
const artifacts = path.join(process.env.CODEX_HOME, 'generated_images', thread);
if (step.png || step.hang) fs.mkdirSync(artifacts, { recursive: true });
if (step.png) fs.copyFileSync(path.join(stamp, step.png), path.join(artifacts, 'call_fixture.png'));
if (step.hang) setInterval(() => {}, 1000);
const output = step.selection ?? step.review;
if (output) fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify(output));
`, { mode: 0o700 });
  });

  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  async function setSteps(steps: object[]) {
    await writeFile(join(directory, 'steps.json'), JSON.stringify(steps));
  }

  async function readPasses() {
    passes = (await readFile(join(directory, 'passes'), 'utf8')).trimEnd().split('\n').map(line => JSON.parse(line));
    return passes;
  }

  function createService(options: { timeoutMs?: number } = {}) {
    return new AiThumbnailService(new CodexThumbnailService({ home, executable, authJson }), {
      files: directory, temp, ...options,
    });
  }

  function attachmentNames(args: string[]) {
    return args.filter((_, index) => args[index - 1] === '--image').map(path => basename(path));
  }

  function job(service: AiThumbnailService, style?: ThumbnailStyle) {
    const started = service.start({ title, date, style, async acknowledge() {}, async background() { return png('gray'); } });
    assert.equal(started.status, 'started');
    return started.result;
  }

  async function assertClean() {
    assert.deepEqual(await readdir(temp), []);
    await assert.rejects(stat(join(home, 'generated_images')), { code: 'ENOENT' });
  }

  it('selects a layout once and keeps the selection and guide through review and retry', async () => {
    await writeFile(join(examples, 'pt-260104.jpg'), png('yellow'));
    await setSteps([
      { png: 'red.png', selection: { sampleNumber: 2 } }, {
        review: {
          ...good, visualQuality: 3, feedback: 'Melhora o contraste do título',
        },
      },
      { png: 'green.png' }, { review: good },
    ]);
    const service = createService();
    process.env.THUMBNAIL_UNRELATED_SECRET = 'isolated';
    try {
      const running = job(service);
      assert.deepEqual(service.start({
        title, date, async acknowledge() {}, async background() { return png('gray'); },
      }), { status: 'busy' });
      assert.deepEqual(await running, { status: 'ready', png: png('green'), quality: 'accepted' });
    } finally {
      delete process.env.THUMBNAIL_UNRELATED_SECRET;
    }
    await readPasses();
    assert.equal(passes.length, 4);
    assert.ok(passes.every(pass => !pass.otherSecret && pass.hasLoginCache));
    assert.ok(passes.every(pass => pass.args.includes('read-only') && pass.args.includes('web_search="disabled"')
        && [ 'shell_tool', 'unified_exec', 'plugins' ].every(feature => pass.args[pass.args.indexOf(feature) - 1] === '--disable')));
    assert.ok(passes.every(pass => pass.prompt.includes(JSON.stringify({
      title, date,
    })) && !pass.args.includes(title)));
    for (const [ index, pass ] of passes.entries()) {
      const review = index % 2 === 1;
      assert.equal(pass.args[pass.args.indexOf('image_generation') - 1], review ? '--disable' : '--enable');
      assert.equal(pass.args.includes('--output-schema'), review || index === 0);
      assert.deepEqual(attachmentNames(pass.args),
          [ ...(review ? [ `candidate-${ (index + 1) / 2 }.png` ] : []),
            'background.png', 'pt-260103.png', 'pt-260104.jpg', 'instructions.jpg' ]);
      if (index > 0) assert.match(pass.prompt, /sample 2/);
      if (!review) {
        const paths = pass.args.filter((_, argIndex) => pass.args[argIndex - 1] === '--image');
        assert.ok(pass.prompt.includes(JSON.stringify({ backgroundPath: paths[0], samplePaths: paths.slice(1, -1) })));
        assert.match(pass.prompt, /referenced_image_paths.*every sample path/);
      }
    }
    assert.match(passes[2].prompt, /Melhora o contraste do título/);
    await assertClean();
  });

  it('caps unclassified artwork at the image tool limit and attaches the guide to the CLI', async () => {
    for (const [ name, color ] of [
      [ 'pt-260101.jpg', 'red' ], [ 'pt-260102.jpeg', 'green' ],
      [ 'pt-260104.JPG', 'yellow' ], [ 'pt-260105.png', 'magenta' ], [ 'pt-999999.txt', 'black' ],
    ]) {
      await writeFile(join(examples, name), png(color));
    }
    await setSteps([ { png: 'green.png', selection: { sampleNumber: 4 } }, { review: good } ]);
    const service = createService();
    assert.equal((await job(service)).status, 'ready');
    const [ generation, review ] = await readPasses();
    assert.deepEqual(attachmentNames(generation.args), [ 'background.png',
      'pt-260101.jpg', 'pt-260102.jpeg', 'pt-260103.png', 'pt-260104.JPG', 'instructions.jpg' ]);
    assert.match(generation.prompt, /referenced_image_paths.*every sample path/);
    assert.deepEqual(attachmentNames(review.args), [ 'candidate-1.png', ...attachmentNames(generation.args) ]);
    assert.match(review.prompt, /sample 4 \(attachment 6\)/);
    await assertClean();
  });

  it('keeps the design guide outside the samples and reviews against the requested template', async () => {
    for (const file of [ 'horizontal-especial.jpg', 'horizontal-1-line.jpg', 'vertical-special.png', 'vertical-yellow.png' ])
      await writeFile(join(examples, file), png('red'));
    await setSteps([ { png: 'green.png' }, { review: good } ]);
    assert.equal((await job(createService(), {
      layout: 'horizontal', template: 'special', separatorColor: '#654321',
    })).status, 'ready');
    const [ generation, review ] = await readPasses();
    const attachments = attachmentNames(generation.args);
    assert.deepEqual(attachments, [
      'background.png', 'horizontal-especial.jpg', 'instructions.jpg',
    ]);
    assert.deepEqual(attachmentNames(review.args), [ 'candidate-1.png', ...attachments ]);
    assert.ok(!generation.args.includes('--output-schema'));
    assert.ok(!generation.prompt.split('\n').find(line => line.startsWith('{"backgroundPath"'))!.includes('instructions.jpg'));
    for (const pass of [ generation, review ]) {
      assert.match(pass.prompt, /sample 1/);
      assert.match(pass.prompt, /1 numbered style samples/);
      assert.match(pass.prompt, /instructions.jpg, is the design guide/);
      assert.match(pass.prompt, /horizontal separator/);
      assert.match(pass.prompt, /special template/);
      assert.match(pass.prompt, /#654321/);
    }
  });

  it('uses a same-orientation color reference when the matching template lacks the requested color', async () => {
    for (const file of [ 'horizontal-especial-yellow.jpg', 'vertical-special.png', 'vertical-2-lines.png', 'vertical-1-line.jpg' ])
      await writeFile(join(examples, file), png('red'));
    await setSteps([ { png: 'green.png' }, { review: good } ]);
    assert.equal((await job(createService(), {
      layout: 'vertical', template: 'special', separatorColor: separatorColors.yellow,
    })).status, 'ready');
    const [ generation, review ] = await readPasses();
    assert.deepEqual(attachmentNames(generation.args), [
      'background.png', 'vertical-special.png', 'vertical-2-lines.png', 'instructions.jpg',
    ]);
    assert.deepEqual(attachmentNames(review.args), [ 'candidate-1.png', ...attachmentNames(generation.args) ]);
    for (const pass of [ generation, review ]) {
      assert.match(pass.prompt, /Use it only for the separator color/);
      assert.match(pass.prompt, /sample 1/);
    }
    assert.match(generation.prompt, /"colorReferencePath":"[^"]*vertical-2-lines.png"/);
  });

  it('keeps just examples matching the orientation, template and color when available', async () => {
    for (const file of [ 'horizontal-1-line.jpg', 'vertical-1-line.jpg', 'vertical-2-lines.png',
      'vertical-special-yellow.png', 'vertical-yellow.png' ])
      await writeFile(join(examples, file), png('red'));
    await setSteps([ { png: 'green.png', selection: { sampleNumber: 2 } }, { review: good } ]);
    assert.equal((await job(createService(), {
      layout: 'vertical', template: 'regular', separatorColor: separatorColors.yellow,
    })).status, 'ready');
    const [ generation, review ] = await readPasses();
    assert.deepEqual(attachmentNames(generation.args), [ 'background.png', 'vertical-2-lines.png', 'vertical-yellow.png', 'instructions.jpg' ]);
    assert.deepEqual(attachmentNames(review.args), [ 'candidate-1.png', ...attachmentNames(generation.args) ]);
    assert.match(review.prompt, /sample 2 \(attachment 4\)/);
  });

  it('uses the guide and background when all tagged references have the opposite orientation', async () => {
    await rm(join(examples, 'pt-260103.png'));
    await writeFile(join(examples, 'horizontal-1-line.jpg'), png('blue'));
    await setSteps([ { png: 'green.png' }, { review: good } ]);
    assert.equal((await job(createService())).status, 'ready');
    const [ generation, review ] = await readPasses();
    assert.deepEqual(attachmentNames(generation.args), [ 'background.png', 'instructions.jpg' ]);
    assert.deepEqual(attachmentNames(review.args), [ 'candidate-1.png', 'background.png', 'instructions.jpg' ]);
    assert.ok(!generation.args.includes('--output-schema'));
  });

  it('requires at least one actual sample even when the guide exists', async () => {
    await rm(join(examples, 'pt-260103.png'));
    assert.deepEqual(await job(createService()), { status: 'failed' });
    await assert.rejects(stat(join(directory, 'passes')), { code: 'ENOENT' });
    await assertClean();
  });

  it('fails before starting Codex if the guide is missing', async () => {
    await rm(join(examples, 'instructions.jpg'));
    assert.deepEqual(await job(createService()), { status: 'failed' });
    await assert.rejects(stat(join(directory, 'passes')), { code: 'ENOENT' });
    await assertClean();
  });

  it('retries generation when the reported sample is out of range', async () => {
    await writeFile(join(examples, 'pt-260104.jpg'), png('red'));
    await setSteps([ { png: 'blue.png', selection: { sampleNumber: 3 } }, {
      png: 'red.png', selection: { sampleNumber: 1 },
    }, { review: good } ]);
    assert.equal((await job(createService())).status, 'ready');
    const [ first, retry, review ] = await readPasses();
    assert.deepEqual(attachmentNames(first.args), attachmentNames(retry.args));
    assert.deepEqual(attachmentNames(review.args), [ 'candidate-2.png', ...attachmentNames(retry.args) ]);
    await assertClean();
  });

  it('ranks exact text ahead of all visual scores, then uses the best combined visual score', async () => {
    await setSteps([
      { png: 'red.png' }, {
        review: {
          ...good, observedTitle: 'Incorrect', backgroundFidelity: 5, visualQuality: 5, styleMatch: 5,
        },
      },
      { png: 'green.png' }, { review: { ...good, visualQuality: 2 } },
      { png: 'blue.png' }, { review: { ...good, visualQuality: 3 } },
    ]);
    const service = createService();
    assert.deepEqual(await job(service), { status: 'ready', png: png('blue'), quality: 'below-target' });
    await assertClean();
  });

  it('rejects stale, invalid, and unreviewed images', async () => {
    const stale = join(home, 'generated_images', '01912345-1234-1234-1234-000000000001');
    await mkdir(stale, { recursive: true });
    await writeFile(join(stale, 'call_stale.png'), png('red'));
    await setSteps([ {}, { png: 'invalid.png' }, { png: 'blue.png' }, { review: { ...good, styleMatch: 6 } } ]);
    const service = createService();
    assert.deepEqual(await job(service), { status: 'failed' });
    assert.equal((await readPasses()).length, 4);
    await assertClean();
  });

  it('kills a timed-out CLI, returns a prior reviewed candidate, and releases the job slot', async () => {
    await setSteps([
      { png: 'red.png' }, { review: { ...good, styleMatch: 3 } }, { hang: true },
      { png: 'green.png' }, { review: good },
    ]);
    const service = createService({ timeoutMs: 1_000 });
    assert.deepEqual(await job(service), { status: 'ready', png: png('red'), quality: 'below-target' });
    assert.equal((await readPasses()).length, 3);
    await assertClean();
    assert.deepEqual(await job(service), { status: 'ready', png: png('green'), quality: 'accepted' });
    await assertClean();
  });

  it('seeds private ChatGPT credentials once and retains subsequent refreshes', async () => {
    await setSteps([ { png: 'green.png' }, { review: good }, { png: 'blue.png' }, { review: good } ]);
    const service = createService();
    assert.equal((await job(service)).status, 'ready');
    const auth = join(home, 'auth.json');
    assert.equal((await stat(home)).mode & 0o777, 0o700);
    assert.equal((await stat(auth)).mode & 0o777, 0o600);
    assert.equal(await readFile(auth, 'utf8'), authJson);
    await writeFile(auth, '{"refreshed":true}');
    assert.equal((await job(createService())).status, 'ready');
    assert.equal(await readFile(auth, 'utf8'), '{"refreshed":true}');
    assert.ok((await readPasses()).every(pass => !pass.otherSecret && pass.hasLoginCache));
    await assertClean();
  });

  it('reports missing, conflicting, malformed, and unsupported credentials', () => {
    assert.equal(new CodexThumbnailService({}).state, 'disabled');
    assert.equal(new CodexThumbnailService({ apiKey: 'mock-key', authJson }).state, 'misconfigured');
    assert.equal(new CodexThumbnailService({ authJson: '{"auth_mode":"api_key"}' }).state, 'misconfigured');
    assert.equal(new CodexThumbnailService({ apiKey: 'mock-key' }).state, 'api-key-unsupported');
  });

  it('logs a correlated CLI failure without copying the request or raw output', async () => {
    const privateDetail = 'private-fixture-detail';
    const step = { error: privateDetail, stderr: `HTTP 422 ${ privateDetail }`, model: 'gpt-6.2-sol' };
    await setSteps([ step, { ...step, routedModel: 'gpt-6.1-sol' }, { ...step, model: undefined } ]);
    const lines: string[] = [];
    const { info, warn } = console;
    try {
      console.info = console.warn = (line: string) => { lines.push(line); };
      const service = createService();
      assert.deepEqual(await job(service), { status: 'failed' });
    } finally {
      console.info = info;
      console.warn = warn;
    }

    const jobId = lines.find(line => line.includes('event=job-start'))?.match(/jobId=([\da-f-]+)/)?.[1];
    assert.ok(jobId);
    const exits = lines.filter(line => line.includes('event=cli-exit'));
    assert.equal(exits.length, 3);
    for (const [ index, line ] of exits.entries()) {
      assert.ok(line.includes(`jobId=${ jobId }`));
      assert.match(line, /stage=generation.*exitCode=1 threadStarted=true turn=failed.* reason=http-422/);
      assert.ok(line.includes(index === 2 ? 'model=unknown' : 'model=gpt-6.2-sol'));
      assert.equal(line.includes('routedModel=gpt-6.1-sol'), index === 1);
    }
    assert.ok(lines.some(line => line.includes(`event=job-finished jobId=${ jobId }`) && line.includes('outcome=failed')));
    for (const value of [ privateDetail, title, authJson, '01912345-1234-1234-1234-' ]) {
      assert.ok(lines.every(line => !line.includes(value)));
    }
  });
});
