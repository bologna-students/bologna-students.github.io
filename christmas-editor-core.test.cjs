'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('./christmas-editor-core.js');

function imageData(bytes, format = 'png') {
  const payload = Buffer.alloc(bytes);
  const signature = format === 'png' ? [137, 80, 78, 71, 13, 10, 26, 10] : format === 'jpeg' ? [255, 216, 255] : [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80];
  if (bytes >= signature.length) payload.set(signature);
  return `data:image/${format === 'jpeg' ? 'jpeg' : format};base64,${payload.toString('base64')}`;
}

test('sniffs only JPEG, PNG, and WebP signatures', () => {
  assert.equal(core.validateRasterHeader(Uint8Array.from([255, 216, 255, 0]), 'image/jpeg'), 'image/jpeg');
  assert.equal(core.validateRasterHeader(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), 'image/png');
  assert.equal(core.validateRasterHeader(Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]), 'image/webp'), 'image/webp');
  assert.throws(() => core.validateRasterHeader(Buffer.from('<svg onload=alert(1)>'), 'image/png'), /unsupported_image_format/);
  assert.throws(() => core.validateRasterHeader(Uint8Array.from([255, 216, 255, 0]), 'image/png'), /unsupported_image_format/);
  assert.throws(() => core.validateRasterHeader(Uint8Array.from([255, 216, 255, 0]), 'text/html'), /unsupported_image_format/);
});

test('accepts only well-formed local PNG/WebP data URLs within the per-image cap', () => {
  assert.equal(core.imageDataUrlBytes(imageData(17)), 17);
  assert.equal(core.isSafeCustomImageDataUrl(imageData(core.imagePolicy.maxImageBytes)), true);
  assert.equal(core.isSafeCustomImageDataUrl(imageData(core.imagePolicy.maxImageBytes + 1)), false);
  assert.equal(core.isSafeCustomImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(core.isSafeCustomImageDataUrl(`data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`), false);
  assert.equal(core.imageDataUrlBytes('data:image/png;base64,AA=A'), null);
});

test('limits custom ornament count, individual bytes, and aggregate bytes', () => {
  const one = { type: 'custom', src: imageData(105 * 1024) };
  assert.equal(core.isWithinCustomImageBudget([one, one]), true);
  assert.equal(core.isWithinCustomImageBudget([one, one, one]), false);
  assert.equal(core.isWithinCustomImageBudget(Array(core.imagePolicy.maxImages + 1).fill({ type: 'custom', src: imageData(16) })), false);
  assert.equal(core.isWithinCustomImageBudget([{ type: 'custom', src: imageData(core.imagePolicy.maxImageBytes + 1) }]), false);
  assert.equal(core.isWithinCustomImageBudget([{ type: 'bauble' }, one]), true);
});

test('detects custom images for the Forest submission boundary', () => {
  assert.equal(core.hasCustomImages({ ornaments: [{ type: 'bauble' }, { type: 'custom' }] }), true);
  assert.equal(core.hasCustomImages({ ornaments: [{ type: 'bauble' }] }), false);
  assert.equal(core.hasCustomImages(null), false);
});

test('re-encodes local raster images on a transparent, scaled canvas and releases temporary resources', async () => {
  const events = { revoked: false, clear: false, draw: null, encoded: null, canvasSize: null };
  class FakeImage {
    naturalWidth = 2000;
    naturalHeight = 1000;
    set src(value) { this._src = value; if (value.startsWith('blob:')) queueMicrotask(() => this.onload?.()); }
    get src() { return this._src || ''; }
  }
  const output = Buffer.alloc(96);
  output.set([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
  let canvas;
  const sandbox = {
    module: { exports: {} },
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    URL: { createObjectURL: () => 'blob:local-test', revokeObjectURL: () => { events.revoked = true; } },
    Image: FakeImage,
    FileReader: class { readAsDataURL(blob) { this.result = `data:${blob.type};base64,${blob.bytes.toString('base64')}`; this.onload(); } },
    document: { createElement: name => { assert.equal(name, 'canvas'); canvas = { width: 0, height: 0, getContext: () => ({ clearRect: (...args) => { events.clear = true; events.clearRect = args; }, drawImage: (...args) => { events.draw = args.slice(1); } }), toBlob: callback => { events.encoded = [canvas.width, canvas.height]; callback({ type: 'image/webp', size: output.length, bytes: output }); } }; return canvas; } },
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./christmas-editor-core.js'), 'utf8'), sandbox);
  const file = { size: 2 * 1024 * 1024, type: 'image/jpeg', slice: () => ({ arrayBuffer: async () => Uint8Array.from([255, 216, 255, 0]).buffer }) };
  const result = await sandbox.module.exports.sanitizeRasterFile(file);
  assert.match(result.dataUrl, /^data:image\/webp;base64,/);
  assert.equal(result.bytes, output.length);
  assert.deepEqual(events.encoded, [1100, 550]);
  assert.equal(events.clear, true);
  assert.deepEqual(events.clearRect, [0, 0, 1100, 550]);
  assert.deepEqual(events.draw, [0, 0, 1100, 550]);
  assert.equal(events.revoked, true);
  assert.deepEqual([canvas.width, canvas.height], [0, 0]);
});

test('rejects excessive source size before image decoding', async () => {
  await assert.rejects(core.sanitizeRasterFile({ size: core.imagePolicy.maxSourceBytes + 1, slice() { throw new Error('must not read'); } }), /image_source_too_large/);
});
