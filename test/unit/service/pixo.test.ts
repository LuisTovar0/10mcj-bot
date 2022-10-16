import {describe, it} from 'mocha';
import * as assert from 'assert';
import PixoService from "../../../src/service/pixo.service";

describe('[Unit] Pixio Editor interaction', function () {
  this.timeout(15000)
  const service = new PixoService();

  it('send', async () => {
    try {
      const r = await service.req('https://icons.iconarchive.com/icons/aha-soft/free-global-security/128/CCTV-Camera-icon.png');
      console.log(r.data);
    }catch (e) {
      console.log(e)
    }
  });

})
