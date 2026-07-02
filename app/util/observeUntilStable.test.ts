import * as FakeTimers from '@sinonjs/fake-timers';
import { Subject } from 'rxjs';

import { observeUntilStable } from './observeUntilStable';

describe('observeUntilStable', () => {
  let clock: FakeTimers.Clock;
  let source$: Subject<number>;

  beforeEach(() => {
    clock = FakeTimers.install();
    source$ = new Subject<number>();
  });

  afterEach(() => {
    clock.uninstall();
  });

  it('debounceMs経過して値が安定したらresolveする', async () => {
    const promise = observeUntilStable(source$, (v) => v > 0, {
      timeoutMs: 15000,
      debounceMs: 500,
    });
    let resolved: number | undefined;
    promise.then((v) => (resolved = v));

    source$.next(1);
    await clock.tickAsync(499);
    expect(resolved).toBeUndefined();

    await clock.tickAsync(1);
    expect(resolved).toBe(1);
  });

  it('debounceMs以内に新しい値が来ると安定判定がリセットされる', async () => {
    const promise = observeUntilStable(source$, (v) => v > 0, {
      timeoutMs: 15000,
      debounceMs: 500,
    });
    let resolved: number | undefined;
    promise.then((v) => (resolved = v));

    source$.next(1);
    await clock.tickAsync(400);
    source$.next(2);
    await clock.tickAsync(400);
    expect(resolved).toBeUndefined();

    await clock.tickAsync(100);
    expect(resolved).toBe(2);
  });

  it('isReadyを満たさない値は無視する', async () => {
    const promise = observeUntilStable(source$, (v) => v > 0, {
      timeoutMs: 15000,
      debounceMs: 500,
    });
    let resolved: number | undefined;
    promise.then((v) => (resolved = v));

    source$.next(0);
    await clock.tickAsync(500);
    expect(resolved).toBeUndefined();

    source$.next(1);
    await clock.tickAsync(500);
    expect(resolved).toBe(1);
  });

  it('timeoutMs以内に安定しなければrejectする', async () => {
    const promise = observeUntilStable(source$, (v) => v > 0, {
      timeoutMs: 15000,
      debounceMs: 500,
    });
    const onError = jest.fn();
    promise.catch(onError);

    await clock.tickAsync(15000);
    expect(onError).toHaveBeenCalled();
  });

  it('timeout後に値が来ても再度resolveしない', async () => {
    const promise = observeUntilStable(source$, (v) => v > 0, {
      timeoutMs: 15000,
      debounceMs: 500,
    });
    const onResolve = jest.fn();
    const onError = jest.fn();
    promise.then(onResolve, onError);

    await clock.tickAsync(15000);
    expect(onError).toHaveBeenCalledTimes(1);

    source$.next(1);
    await clock.tickAsync(500);
    expect(onResolve).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
