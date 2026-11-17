import { describe, it } from 'mocha';
import * as assert from 'node:assert/strict';
import { loadImage } from 'canvas';
import * as fs from "fs";

import CanvasService from "../../../src/service/canvas.service";
import { filesFolder } from "../../../src/config/constants";

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

});
