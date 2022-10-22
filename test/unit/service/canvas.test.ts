import {describe, it} from 'mocha';
import {LoremIpsum} from 'lorem-ipsum';
import moment from 'moment';
import * as fs from "fs";

import CanvasService from "../../../src/service/canvas.service";
import {filesFolder} from "../../../src/config/constants";

describe('[Unit] Canvas Service', function () {
  this.timeout(20_000);
  const service = new CanvasService();

  it('Create image', async () => {
    const file = fs.readFileSync(`${filesFolder}/rapaz.jpg`);
    const words = new LoremIpsum().generateWords(Math.floor(Math.random() * 5 + 4));
    const buffer = await service.generate(file, "12 Outubro 2022", words, {imgAlign: 820, titleSize: 75});
    fs.writeFileSync(`./${moment().valueOf()}.png`, buffer);
  });

});
