import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCloseDelay, searchPanelTop, searchTriggerHeight } from '../src/client/search-policy';

test('the mouse edge matches the visible 16px trigger rather than the article return row', () => {
  assert.equal(searchTriggerHeight(600), 16);
  assert.equal(searchTriggerHeight(1600), 16);
  assert.equal(searchTriggerHeight(12), 12);
});

test('search stays below a visible return row, otherwise using its normal top', () => {
  assert.equal(searchPanelTop({ top: 32, bottom: 63 }, 900), 75);
  assert.equal(searchPanelTop({ top: -10, bottom: 8 }, 900), 24);
  assert.equal(searchPanelTop({ top: -10, bottom: 20 }, 900), 32);
  assert.equal(searchPanelTop(null, 900), 24);
  assert.equal(searchPanelTop({ top: -40, bottom: 0 }, 900), 24);
  assert.equal(searchPanelTop({ top: 900, bottom: 940 }, 900), 24);
  for (const rect of [
    { top: NaN, bottom: 63 },
    { top: 32, bottom: Infinity },
    { top: 63, bottom: 32 },
  ])
    assert.equal(searchPanelTop(rect, 900), 24);
  for (const viewport of [0, -1, NaN, Infinity])
    assert.equal(searchPanelTop({ top: 32, bottom: 63 }, viewport), 24);
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
