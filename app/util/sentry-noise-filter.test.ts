import type { ErrorEvent } from '@sentry/electron/renderer';

import { filterNoiseErrorEvent } from './sentry-noise-filter';

function makeErrorEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return { ...overrides } as ErrorEvent;
}

describe('filterNoiseErrorEvent', () => {
  test('diagnostic タグ付きイベントは NOISE チェックより前に通す', () => {
    const event = makeErrorEvent({
      tags: { diagnostic: true },
      message: 'Failed to make IPC call, verify IPC status.',
    });
    expect(filterNoiseErrorEvent(event)).toBe(event);
  });

  test('event.message が NOISE_PATTERNS に一致する場合は抑制する', () => {
    const event = makeErrorEvent({ message: 'network error: connection lost' });
    expect(filterNoiseErrorEvent(event)).toBeNull();
  });

  test('event.exception の value が NOISE_PATTERNS に一致する場合は抑制する', () => {
    const event = makeErrorEvent({
      exception: { values: [{ value: 'Failed to fetch' }] },
    });
    expect(filterNoiseErrorEvent(event)).toBeNull();
  });

  test('console.error(msg, err) 経由で extra.exception に IPC 切断エラーが入っている場合も抑制する (N-AIR-APP-E4F)', () => {
    const event = makeErrorEvent({
      message: 'Array node step failed',
      extra: {
        exception: 'Error: Failed to make IPC call, verify IPC status.\n    at ScenesService.createScene',
      },
    });
    expect(filterNoiseErrorEvent(event)).toBeNull();
  });

  test('ノイズパターンに一致しない場合はそのまま通す', () => {
    const event = makeErrorEvent({ message: 'Some genuine bug' });
    expect(filterNoiseErrorEvent(event)).toBe(event);
  });
});
