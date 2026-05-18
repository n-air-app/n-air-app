import * as FakeTimers from '@sinonjs/fake-timers';

import { ScheduledExecutionQueue } from './ScheduledExecutionQueue';

describe('ScheduledExecutionQueue', () => {
  let clock: FakeTimers.InstalledClock;
  let processor: jest.Mock<Promise<boolean>, [string]>;
  let queue: ScheduledExecutionQueue<string>;

  beforeEach(() => {
    clock = FakeTimers.install();
    processor = jest.fn().mockResolvedValue(true);
    queue = new ScheduledExecutionQueue<string>(processor);
  });

  afterEach(() => {
    queue.destroy();
    clock.uninstall();
  });

  it('should process a single item at the scheduled time', async () => {
    const now = clock.now;
    queue.add('item1', new Date(now + 1000));
    expect(processor).not.toHaveBeenCalled();

    await clock.tickAsync(1000);

    expect(processor).toHaveBeenCalledWith('item1');
    expect(processor).toHaveBeenCalledTimes(1);
  });

  it('should process items in chronological order', async () => {
    const now = clock.now;
    queue.add('item2', new Date(now + 2000));
    queue.add('item1', new Date(now + 1000));

    await clock.tickAsync(1000);
    expect(processor).toHaveBeenCalledWith('item1');
    expect(processor).toHaveBeenCalledTimes(1);

    await clock.tickAsync(1000);
    expect(processor).toHaveBeenCalledWith('item2');
    expect(processor).toHaveBeenCalledTimes(2);
  });

  it('should process items with past timestamps immediately', async () => {
    const now = clock.now;
    queue.add('item1', new Date(now - 1000));

    await clock.tickAsync(0);

    expect(processor).toHaveBeenCalledWith('item1');
  });

  it('should postpone processing if the processor returns false', async () => {
    processor.mockResolvedValue(false);
    const now = clock.now;
    queue.add('item1', new Date(now + 1000));
    queue.add('item2', new Date(now + 2000));

    await clock.tickAsync(1000);

    expect(processor).toHaveBeenCalledWith('item1');
    expect(processor).toHaveBeenCalledTimes(1);

    // Should not process the next item because the first one is blocking
    await clock.tickAsync(1000);
    expect(processor).toHaveBeenCalledTimes(1);
  });

  it('should resume processing when resume() is called', async () => {
    processor.mockResolvedValue(false);
    const now = clock.now;
    queue.add('item1', new Date(now + 1000));

    await clock.tickAsync(1000);
    expect(processor).toHaveBeenCalledTimes(1);

    processor.mockResolvedValue(true);
    queue.resume();
    // resume() is synchronous, but the processor is async, so we need to wait for it
    await clock.runAllAsync();

    expect(processor).toHaveBeenCalledWith('item1');
    expect(processor).toHaveBeenCalledTimes(2);
  });

  it('should proceed to the next item after a successful resume', async () => {
    processor.mockResolvedValueOnce(false);
    const now = clock.now;
    queue.add('item1', new Date(now + 1000));
    queue.add('item2', new Date(now + 2000));

    await clock.tickAsync(1000);
    expect(processor).toHaveBeenCalledWith('item1');
    expect(processor).toHaveBeenCalledTimes(1);

    processor.mockResolvedValueOnce(true);
    queue.resume();
    await clock.tickAsync(0); // resume()によって即時実行されるタスクのみを処理する
    expect(processor).toHaveBeenCalledTimes(2);

    await clock.tickAsync(1000);
    expect(processor).toHaveBeenCalledWith('item2');
    expect(processor).toHaveBeenCalledTimes(3);
  });

  it('should clear the queue and timers', async () => {
    const now = clock.now;
    queue.add('item1', new Date(now + 1000));
    queue.clear();

    await clock.tickAsync(1000);

    expect(processor).not.toHaveBeenCalled();
  });
});
