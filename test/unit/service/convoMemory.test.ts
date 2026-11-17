import { describe, it } from 'mocha';
import * as assert from 'node:assert/strict';
import {
  InfosForText, isAddImageData, isInfosForText, isTextData, isVideoData,
} from "../../../src/service/i-service/telegram-bot/i-convo-memory.service";

describe('[Unit] Convo Memory general functions', () => {

  describe('isInfosForText', () => {

    const text: InfosForText = { telegram: '', signal: '', date: '', descr1: '' };

    for (const field of [ 'telegram', 'signal', 'date', 'descr1' ] as const) {
      it(`rejects a missing or invalid ${ field }`, () => {
        const incomplete: Partial<InfosForText> = { ...text };
        delete incomplete[field];
        assert.equal(isInfosForText(incomplete), false);
        for (const value of [ undefined, null, 1, false, {}, [] ]) {
          assert.equal(isInfosForText({ ...text, [field]: value }), false, `${ field }=${ JSON.stringify(value) }`);
        }
      });
    }

    it('validates the optional second description when present', () => {
      assert.equal(isInfosForText({ ...text, descr2: undefined }), true);
      assert.equal(isInfosForText({ ...text, descr2: 'Second description' }), true);
      for (const descr2 of [ null, 1, false, {}, [] ]) {
        assert.equal(isInfosForText({ ...text, descr2 }), false, `descr2=${ JSON.stringify(descr2) }`);
      }
    });

    it(`true if it's all strings`, () =>
        assert.ok(isInfosForText({ telegram: '', signal: '', date: '', descr1: '', descr2: '' })));

    it(`true if it's all strings but there's no descr2`, () =>
        assert.ok(isInfosForText({ telegram: '', signal: '', date: '', descr1: '' })));

    it(`false if it's undefined`, () =>
        assert.equal(isInfosForText(undefined), false));

    it(`false if it's null`, () =>
        assert.equal(isInfosForText(null), false));

    it(`false if a field isn't a string`, () => {
      assert.equal(isInfosForText({ telegram: 1, signal: '', date: '', descr1: '', descr2: '' }), false);
      assert.equal(isInfosForText({ telegram: '', signal: 1, date: '', descr1: '', descr2: '' }), false);
      assert.equal(isInfosForText({ telegram: '', signal: '', date: 1, descr1: '', descr2: '' }), false);
      assert.equal(isInfosForText({ telegram: '', signal: '', date: '', descr1: 1, descr2: '' }), false);
      assert.equal(isInfosForText({ telegram: '', signal: '', date: '', descr1: '', descr2: 1 }), false);
    });

  });

  describe(`isTextData`, () => {

    it('accepts true audio and rejects truthy non-booleans', () => {
      assert.equal(isTextData({ audio: true }), true);
      for (const audio of [ undefined, null, 0, 1, 'false' ]) {
        assert.equal(isTextData({ audio }), false, `audio=${ JSON.stringify(audio) }`);
      }
    });

    it('rejects present but malformed text', () => {
      for (const text of [ null, 'text', {}, { telegram: '', signal: '', date: '' } ]) {
        assert.equal(isTextData({ audio: false, text }), false, `text=${ JSON.stringify(text) }`);
      }
    });

    it(`false if it's undefined`, () =>
        assert.equal(isTextData(undefined), false));

    it(`false if it's null`, () =>
        assert.equal(isTextData(null), false));

    it(`true if audio is boolean but text is undefined`, () =>
        assert.ok(isTextData({ audio: false })));

    it(`true if audio is boolean and text is valid`, () =>
        assert.ok(isTextData({ audio: false, text: { telegram: '', signal: '', date: '', descr1: '', descr2: '' } })));

    it(`false if audio is boolean and text is invalid`, () =>
        assert.equal(isTextData({
          audio: false,
          text: { telegram: 1, signal: '', date: '', descr1: '', descr2: '' },
        }), false));

    it(`false if audio is not boolean but text is valid`, () =>
        assert.equal(isTextData({
          audio: 1, text: { telegram: '', signal: '', date: '', descr1: '', descr2: '' },
        }), false));

  });

  describe('isAddImageData', () => {
    it('accepts an unfinished image conversation', () => {
      assert.equal(isAddImageData({}), true);
      assert.equal(isAddImageData({ name: 'Morning' }), true);
      assert.equal(isAddImageData({ image: Buffer.from([ 1, 2, 3 ]) }), true);
      assert.equal(isAddImageData({ name: 'Morning', image: Buffer.alloc(0) }), true);
    });

    it('rejects absent data', () => {
      assert.equal(isAddImageData(undefined), false);
      assert.equal(isAddImageData(null), false);
    });

    it('rejects invalid images', () => {
      for (const image of [ null, false, 123, {} ]) {
        assert.equal(isAddImageData({ image }), false, `image=${ JSON.stringify(image) }`);
      }
    });

    it('rejects invalid names with and without an image', () => {
      for (const name of [ null, 123, false, {} ]) {
        assert.equal(isAddImageData({ name }), false, `name=${ JSON.stringify(name) }`);
        assert.equal(isAddImageData({ name, image: Buffer.from([ 1 ]) }), false, `name=${ JSON.stringify(name) }`);
      }
    });
  });

  describe('isVideoData', () => {
    const video = { audio: false, image: Buffer.from([ 1, 2, 3 ]), text: 'Title' };

    it('accepts either audio state and empty text', () => {
      assert.equal(isVideoData(video), true);
      assert.equal(isVideoData({ ...video, audio: true, text: '' }), true);
    });

    it('rejects absent data', () => {
      assert.equal(isVideoData(undefined), false);
      assert.equal(isVideoData(null), false);
    });

    for (const field of [ 'audio', 'image', 'text' ] as const) {
      it(`rejects a missing ${ field }`, () => {
        assert.equal(isVideoData({ ...video, [field]: undefined }), false);
      });
    }

    it('requires an actual Buffer for the image', () => {
      for (const image of [ null, 'image', [ 1, 2, 3 ], { type: 'Buffer', data: [ 1, 2, 3 ] } ]) {
        assert.equal(isVideoData({ ...video, image }), false, `image=${ JSON.stringify(image) }`);
      }
    });

    it('rejects non-boolean audio and non-string text', () => {
      assert.equal(isVideoData({ ...video, audio: 'false' }), false);
      assert.equal(isVideoData({ ...video, text: { descr1: 'Title' } }), false);
    });
  });

});
