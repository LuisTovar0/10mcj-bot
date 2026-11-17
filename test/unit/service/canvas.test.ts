import { createCanvas, loadImage } from 'canvas';
import * as fs from "fs";
import { describe, it } from 'mocha';
import * as assert from 'node:assert/strict';
import { filesFolder } from "../../../src/config/constants";

import CanvasService from "../../../src/service/canvas.service";

describe('[Unit] Canvas Service', function () {
  this.timeout(20_000);
  const service = new CanvasService();

  it('Create image', async () => {
    const file = fs.readFileSync(`${ filesFolder }/rapaz.jpg`);
    const buffer = await service.generate(file, "12 Outubro 2022", "Uma meditação para hoje", {
      imgAlign: 820, titleSize: 75,
    });
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const image = await loadImage(buffer);
    assert.equal(image.width, 2560);
    assert.equal(image.height, 1440);
  });

  it('draws the source photo and applies its horizontal alignment', async () => {
    // Solid colors keep this check independent of fonts and JPEG decoding.
    const photo = createCanvas(200, 100);
    const photoContext = photo.getContext('2d');
    photoContext.fillStyle = '#ff0000';
    photoContext.fillRect(0, 0, 100, 100);
    photoContext.fillStyle = '#0000ff';
    photoContext.fillRect(100, 0, 100, 100);

    for (const { options, expected } of [
      { options: undefined, expected: [ 0, 0, 255, 255 ] },
      { options: { imgAlign: 200 }, expected: [ 255, 0, 0, 255 ] },
    ]) {
      const buffer = await service.generate(photo.toBuffer('image/png'), '', '', options);
      const rendered = createCanvas(2560, 1440);
      const context = rendered.getContext('2d');
      context.drawImage(await loadImage(buffer), 0, 0);

      assert.deepEqual(Array.from(context.getImageData(2300, 700, 1, 1).data), expected,
          `photo pixel with imgAlign=${ options?.imgAlign }`);
    }
  });

  it('rejects an invalid source image', async () => {
    await assert.rejects(() => service.generate(Buffer.from('not an image'), 'Date', 'Title'));
  });

  describe('wrapText', () => {
    const cases = [
      { name: 'a short title', text: 'one two', maxWidth: 20, lines: [ 'one two' ] },
      { name: 'a line exactly at the width limit', text: 'one two', maxWidth: 8, lines: [ 'one two' ] },
      { name: 'multiple lines', text: 'one two three four', maxWidth: 10, lines: [ 'one two', 'three', 'four' ] },
      {
        name: 'an oversized word without an empty leading line', text: 'oversized two', maxWidth: 4,
        lines: [ 'oversized', 'two' ],
      },
    ];

    for (const { name, text, maxWidth, lines } of cases) {
      it(`draws ${ name }`, () => {
        const drawn: { text: string; x: number; y: number }[] = [];
        const context = {
          measureText: (value: string) => ({ width: value.length }),
          fillText: (value: string, x: number, y: number) => drawn.push({ text: value.trimEnd(), x, y }),
        };

        service.wrapText(context, text, 10, 20, maxWidth, 15);

        assert.deepEqual(drawn, lines.map((line, index) => ({ text: line, x: 10, y: 20 + index * 15 })));
      });
    }
  });

});
