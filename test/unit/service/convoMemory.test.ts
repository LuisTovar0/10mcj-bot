import {describe, it} from 'mocha';
import * as assert from 'assert';
import {isInfosForText, isTextData} from "../../../src/service/iService/telegramBot/iConvoMemory.service";

describe('[Unit] Convo Memory general functions', () => {

  describe('isInfosForText', () => {

    it(`true if it's all strings`, () =>
      assert.ok(isInfosForText({telegram: '', signal: '', date: '', descr1: '', descr2: ''})));

    it(`true if it's all strings but there's no descr2`, () =>
      assert.ok(isInfosForText({telegram: '', signal: '', date: '', descr1: ''})));

    it(`false if it's undefined`, () =>
      assert.equal(isInfosForText(undefined), false));

    it(`false if it's null`, () =>
      assert.equal(isInfosForText(null), false));

    it(`false if a field isn't a string`, () => {
      assert.equal(isInfosForText({telegram: 1, signal: '', date: '', descr1: '', descr2: ''}), false);
      assert.equal(isInfosForText({telegram: '', signal: 1, date: '', descr1: '', descr2: ''}), false);
      assert.equal(isInfosForText({telegram: '', signal: '', date: 1, descr1: '', descr2: ''}), false);
      assert.equal(isInfosForText({telegram: '', signal: '', date: '', descr1: 1, descr2: ''}), false);
      assert.equal(isInfosForText({telegram: '', signal: '', date: '', descr1: '', descr2: 1}), false);
    });

  });

  describe(`isTextData`, () => {

    it(`false if it's undefined`, () =>
      assert.equal(isTextData(undefined), false));

    it(`false if it's null`, () =>
      assert.equal(isTextData(null), false));

    it(`true if audio is boolean but text is undefined`, () =>
      assert.ok(isTextData({audio: false})));

    it(`true if audio is boolean and text is valid`, () =>
      assert.ok(isTextData({audio: false, text: {telegram: '', signal: '', date: '', descr1: '', descr2: ''}})));

    it(`false if audio is boolean and text is invalid`, () =>
      assert.equal(isTextData({
        audio: false,
        text: {telegram: 1, signal: '', date: '', descr1: '', descr2: ''}
      }), false));

    it(`false if audio is not boolean but text is valid`, () =>
      assert.equal(isTextData({audio: 1, text: {telegram: '', signal: '', date: '', descr1: '', descr2: ''}}), false));

  });

});
