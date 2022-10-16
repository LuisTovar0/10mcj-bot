import { describe, it } from 'mocha';
import * as assert from 'assert';
import CanvasService from "../../../src/service/canvas.service";

describe('[Unit] Canvas Service', function () {
  this.timeout(20_000);
  const service = new CanvasService();

  it('Create image', () =>
    service.req('./rapaz.jpg', "12 Outubro 2022", "Freedom oh oh freedom more freedom", {
      imgAlign: 820,
      titleSize: 75
    }));

});
