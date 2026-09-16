import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCloseDelay, searchTriggerHeight } from '../src/client/search-policy';

test('top target is 8 percent with a 64px cap on tall screens', () => {
  assert.equal(searchTriggerHeight(600), 48);
  assert.equal(searchTriggerHeight(1600), 64);
});
test('pointer, focus and composition protection take priority over expiry', () => {
  assert.equal(searchCloseDelay({ protected: true, hasCriteria: false, elapsed: 70_000 }), null);
  assert.equal(searchCloseDelay({ protected: true, hasCriteria: true, elapsed: 70_000 }), null);
});
test('empty accidental search leaves promptly; populated search retains remaining time', () => {
  assert.equal(searchCloseDelay({ protected: false, hasCriteria: false, elapsed: 500 }), 450);
  assert.equal(searchCloseDelay({ protected: false, hasCriteria: true, elapsed: 15_000 }), 45_000);
  assert.equal(searchCloseDelay({ protected: false, hasCriteria: true, elapsed: 70_000 }), 0);
});
