const test = require('node:test');
const assert = require('node:assert/strict');
const { dedupeSongs } = require('../lib/importDedup');
const { computeSongHash } = require('../lib/songHash');

const song = (index, content) => ({ index, content, title: 'T' });

test('inserts songs not already present', () => {
  const { toInsert, skipped } = dedupeSongs(new Set(), [song(0, '[G]a'), song(1, '[C]b')]);
  assert.equal(toInsert.length, 2);
  assert.equal(skipped.length, 0);
  assert.match(toInsert[0].content_hash, /^[0-9a-f]{64}$/);
  assert.equal(toInsert[0].title, 'T');
});

test('skips songs whose hash is already in the library', () => {
  const existing = new Set([computeSongHash('[G]a')]);
  const { toInsert, skipped } = dedupeSongs(existing, [song(0, '[G]a'), song(1, '[C]b')]);
  assert.deepEqual(toInsert.map((s) => s.index), [1]);
  assert.deepEqual(skipped, [{ index: 0, reason: 'already_exists' }]);
});

test('collapses intra-batch duplicates to one insert', () => {
  const { toInsert, skipped } = dedupeSongs(new Set(), [song(0, '[G]a'), song(1, '[G]a')]);
  assert.deepEqual(toInsert.map((s) => s.index), [0]);
  assert.deepEqual(skipped, [{ index: 1, reason: 'already_exists' }]);
});

test('normalization: whitespace-only difference counts as duplicate', () => {
  const existing = new Set([computeSongHash('[G]a')]);
  const { toInsert, skipped } = dedupeSongs(existing, [song(0, '[G]a   \r\n')]);
  assert.equal(toInsert.length, 0);
  assert.equal(skipped.length, 1);
});
