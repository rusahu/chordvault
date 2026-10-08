const test = require('node:test');
const assert = require('node:assert/strict');
const { parseId, isValidDate, validateUserCredentials, validateSongInput, validateSetlistInput, parsePaginationParams } = require('../lib/validation');

test('IDs are positive safe integers with no coercion of other types', () => {
  for (const value of ['12junk','1.5','1e3','',0,-1,1.5,true,[],{},Number.MAX_SAFE_INTEGER+1]) assert.equal(parseId(value),null,JSON.stringify(value));
  assert.equal(parseId(' 12 '),12);
  assert.equal(parseId(12),12);
});
test('dates must be real calendar dates', () => {
  for (const value of ['2026-02-31','2025-02-29','2026-13-01',{},null]) assert.equal(isValidDate(value),false);
  assert.equal(isValidDate('2024-02-29'),true);
});
test('validators reject malformed field types instead of throwing', () => {
  for (const value of [123,true,[],{}]) {
    assert.ok(validateUserCredentials(value,'password123'));
    assert.ok(validateUserCredentials('validuser',value));
    assert.ok(validateSongInput({content:value}));
    assert.ok(validateSongInput({title:value}));
    assert.ok(validateSongInput({youtube_url:value}));
    assert.ok(validateSetlistInput(value));
  }
});
test('pagination retains omission defaults and rejects explicit invalid values', () => {
  assert.deepEqual(parsePaginationParams(),{page:null,limit:null});
  assert.deepEqual(parsePaginationParams('2'),{page:2,limit:20});
  assert.deepEqual(parsePaginationParams(undefined,'5'),{page:1,limit:5});
  for (const value of ['0','-1','12junk','',null,[],{}]) assert.throws(()=>parsePaginationParams(value,'10'),err=>err.status===400);
  assert.throws(()=>parsePaginationParams(Number.MAX_SAFE_INTEGER,10),err=>err.status===400);
});
