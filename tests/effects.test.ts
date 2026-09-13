import { test } from 'node:test';
import assert from 'node:assert/strict';
import mountIndex from '../src/client/effects/isaca';
import type { HeroContext } from '../src/client/hero';

test('index cards keep only the front card interactive and remove controls on unmount', async () => {
  const cards = [
    { dataset: {}, inert: false },
    { dataset: {}, inert: false },
  ];
  const button = new EventTarget();
  const controller = new AbortController();
  const host = { querySelectorAll: () => cards, querySelector: () => button };
  await mountIndex({ host, reduced: true, signal: controller.signal } as unknown as HeroContext);
  assert.deepEqual(
    cards.map((card) => card.inert),
    [false, true],
  );
  button.dispatchEvent(new Event('click'));
  assert.deepEqual(
    cards.map((card) => card.inert),
    [true, false],
  );
  controller.abort();
  button.dispatchEvent(new Event('click'));
  assert.deepEqual(
    cards.map((card) => card.inert),
    [true, false],
  );
});
