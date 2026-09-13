import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { initAudio } from '../src/client/audio';

class Control extends EventTarget {
  textContent = '';
  value = '';
  disabled = false;
  closest() {
    return null;
  }
}
class Media extends Control {
  src = '';
  paused = true;
  attempts = 0;
  volume = 1;
  play() {
    this.attempts++;
    if (this.attempts === 1) return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
test('autoplay rejection waits for intent, and pause survives unrelated clicks', async () => {
  const audio = new Media(),
    data = new Control(),
    select = new Control(),
    button = new Control(),
    status = new Control(),
    volume = new Control(),
    volumeValue = new Control();
  data.textContent = JSON.stringify([
    { id: 'test', name: 'Test', url: 'http://localhost/audio.wav' },
  ]);
  const elements: Record<string, Control> = {
    '#audio': audio,
    '#radio-data': data,
    '#station': select,
    '#audio-toggle': button,
    '#audio-status': status,
    '#volume': volume,
    '#volume-value': volumeValue,
  };
  const document = Object.assign(new EventTarget(), {
    querySelector: (key: string) => elements[key],
  });
  const storage = new Map<string, string>();
  const savedStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    configurable: true,
  });
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'),
    savedElement = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
  Object.defineProperty(globalThis, 'Element', { value: Control, configurable: true });
  try {
    initAudio();
    assert.equal(audio.volume, 0.2);
    assert.equal(volume.value, '20');
    for (const [input, expected] of [
      ['0', 0],
      ['65', 0.65],
      ['150', 1],
      ['invalid', 0.2],
    ] as const) {
      volume.value = input;
      volume.dispatchEvent(new Event('input'));
      assert.equal(audio.volume, expected);
      assert.equal(storage.get('bh:volume'), String(expected * 100));
      assert.equal(volumeValue.textContent, `${expected * 100}%`);
    }
    await setImmediate();
    assert.equal(status.textContent, '点击一次，开始播放');
    assert.equal(audio.paused, true);
    document.dispatchEvent(new Event('click'));
    await setImmediate();
    assert.equal(audio.paused, false);
    assert.equal(status.textContent, '正在播放');
    button.dispatchEvent(new Event('click'));
    document.dispatchEvent(new Event('click'));
    await setImmediate();
    assert.equal(audio.paused, true);
    assert.equal(audio.attempts, 2);
    button.dispatchEvent(new Event('click'));
    await setImmediate();
    audio.dispatchEvent(new Event('ended'));
    assert.equal(status.textContent, '已暂停');
    document.dispatchEvent(new Event('click'));
    assert.equal(audio.attempts, 3);
  } finally {
    if (savedStorage) Object.defineProperty(globalThis, 'localStorage', savedStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (savedElement) Object.defineProperty(globalThis, 'Element', savedElement);
    else Reflect.deleteProperty(globalThis, 'Element');
  }
});
