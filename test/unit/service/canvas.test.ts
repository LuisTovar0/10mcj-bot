import {describe, it} from 'mocha';
import CanvasService from "../../../src/service/canvas.service";
import {filesFolder} from "../../../src/bot/general";

describe('[Unit] Canvas Service', function () {
  this.timeout(20_000);
  const service = new CanvasService();

  it('Create image', () =>
    service.req(`${filesFolder}/rapaz.jpg`, "12 Outubro 2022", "Freedom oh oh freedom more freedom", {
      imgAlign: 820,
      titleSize: 75
    }));

});
