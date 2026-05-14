import { sleep } from 'util/sleep';

import { QueueRunner, StartFunc } from './QueueRunner';

class Task {
  completePrepare: (skip: boolean) => void;
  completeRun: () => void;
  prepare: () => Promise<StartFunc | null>;
  private _state: 'idle' | 'preparing' | 'running' | 'completed' | 'canceled' | 'paused' = 'idle';

  get state() {
    return this._state;
  }

  constructor(startCallback: (task: Task) => void = undefined) {
    const prepare = new Promise<boolean>((resolve) => {
      this.completePrepare = (skip) => {
        resolve(skip);
      };
    });
    const run = new Promise<void>((resolve) => {
      this.completeRun = () => {
        resolve();
        this._state = 'completed';
      };
    });
    this.prepare = async (): Promise<StartFunc | null> => {
      this._state = 'preparing';
      if (startCallback) {
        startCallback(this);
      }
      return prepare.then((skip) => {
        if (skip) {
          return null;
        } else {
          return async () => {
            this._state = 'running';
            return {
              cancel: async () => {
                this.completeRun();
                await run;
                this._state = 'canceled';
              },
              pause: () => {
                if (this._state === 'running') {
                  this._state = 'paused';
                }
              },
              resume: () => {
                if (this._state === 'paused') {
                  this._state = 'running';
                }
              },
              running: run,
            };
          };
        }
      });
    };
  }
}

describe('QueueRunner', () => {
  test('empty', async () => {
    const queue = new QueueRunner();
    expect(queue.length).toBe(0);
    expect(queue.state).toBe(null);
    expect(queue.isRunning).toBe(false);
  });

  test('normal lifecycle', async () => {
    const queue = new QueueRunner();
    const task = new Task();

    queue.add(task.prepare, 'one');
    expect(queue.length).toBe(1);
    expect(queue.state).toBe(null);
    expect(queue.isRunning).toBe(true);
    queue.runNext();
    await sleep(0);
    expect(queue.length).toBe(1);
    expect(queue.state).toBe('preparing');
    expect(queue.isRunning).toBe(true);
    task.completePrepare(false);
    await sleep(0);
    expect(queue.length).toBe(0);
    expect(queue.state).toBe('running');
    expect(queue.isRunning).toBe(true);
    task.completeRun();
    await queue.waitUntilFinished();
    expect(queue.length).toBe(0);
    expect(queue.state).toBe(null);
    expect(queue.isRunning).toBe(false);
  });

  test('normal skip', async () => {
    const queue = new QueueRunner();
    const task = new Task();

    queue.add(task.prepare, 'one');
    expect(queue.length).toBe(1);
    expect(queue.state).toBe(null);
    expect(queue.isRunning).toBe(true);
    queue.runNext();
    await sleep(0);
    expect(queue.length).toBe(1);
    expect(queue.state).toBe('preparing');
    expect(queue.isRunning).toBe(true);
    task.completePrepare(true);
    await queue.waitUntilFinished();
    expect(queue.length).toBe(0);
    expect(queue.state).toBe(null);
    expect(queue.isRunning).toBe(false);
  });

  test('early cancel', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    expect(queue.length).toBe(1);
    await queue.cancel();
    await queue.waitUntilFinished();
    expect(task.state).toBe('idle');
    expect(queue.length).toBe(0);
    expect(queue.state).toBe(null);
    expect(queue.isRunning).toBe(false);
  });

  test('cancel while preparing', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    queue.runNext();
    await sleep(0);
    expect(task.state).toBe('preparing');
    await queue.cancel();
    task.completePrepare(false);
    await queue.waitUntilFinished();
    expect(task.state).toBe('canceled');
    expect(queue.length).toBe(0);
    expect(queue.state).toBe(null);
    expect(queue.isRunning).toBe(false);
  });

  test('cancel while running', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    queue.runNext();
    await sleep(0);
    task.completePrepare(false);
    await sleep(0);
    expect(task.state).toBe('running');
    await queue.cancel();
    await queue.waitUntilFinished();
    expect(task.state).toBe('canceled');
    expect(queue.length).toBe(0);
    expect(queue.state).toBe(null);
    expect(queue.isRunning).toBe(false);
  });

  test('run sequentially', async () => {
    const queue = new QueueRunner({
      log: ({ state, label }) => console.log(`QueueRunner: ${state} ${label}`),
    });
    const results: number[] = [];
    for (const n of [1, 2, 3]) {
      const task = new Task((t) => {
        results.push(n);
        t.completePrepare(false);
        t.completeRun();
      });
      queue.add(task.prepare, n.toString());
    }
    queue.runNext();
    await queue.waitUntilFinished();
    expect(results).toEqual([1, 2, 3]);
  });

  test('cancelQueue', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    task.completePrepare(false);
    const task2 = new Task();
    queue.add(task2.prepare, 'two');
    expect(queue.length).toBe(2);
    queue.runNext();
    await sleep(0);
    expect(task.state).toBe('running');
    expect(queue.isRunning).toBe(true);
    queue.cancelQueue();
    expect(task.state).toBe('running');
    expect(queue.length).toBe(0);
    task.completeRun();
    await queue.waitUntilFinished();
    expect(queue.isRunning).toBe(false);
  });

  test('disable すると state は disabled になる', async () => {
    const queue = new QueueRunner();
    await queue.disable();
    expect(queue.state).toBe('disabled');
  });

  test("再生(running)中にdisable({interruptAction: 'cancel'})するとキャンセルされる", async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    queue.runNext();
    task.completePrepare(false);
    await sleep(0);
    expect(task.state).toBe('running');

    await queue.disable({ interruptAction: 'cancel' });

    await queue.waitUntilFinished();
    expect(task.state).toBe('canceled');
  });

  test('disable中にキューに追加した場合、enableしたときに実行される', async () => {
    const queue = new QueueRunner();

    await queue.disable();

    const task = new Task();
    queue.add(task.prepare, 'one');
    expect(queue.length).toBe(1);
    expect(queue.state).toBe('disabled');

    queue.enable();

    await sleep(0);
    expect(queue.state).toBe('preparing');
    task.completePrepare(false);
    await sleep(0);
    expect(queue.state).toBe('running');
    task.completeRun();
    await queue.waitUntilFinished();
    expect(queue.state).toBe(null);
  });

  test('再生(preparing)中にdisableすると実行を延期し、enableすると実行する', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    queue.runNext();
    await sleep(0);
    expect(task.state).toBe('preparing');

    await queue.disable();

    task.completePrepare(false);
    await sleep(0);
    expect(task.state).toBe('preparing');

    queue.enable();
    await sleep(0);
    expect(task.state).toBe('running');

    task.completeRun();
    await queue.waitUntilFinished();
    expect(task.state).toBe('completed');
  });

  test('preparing中にpauseすると再生を開始しない。enableすると再生を開始する', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    queue.runNext();
    await sleep(0);
    expect(task.state).toBe('preparing');

    await queue.disable({ interruptAction: 'pause' });
    task.completePrepare(false);
    await sleep(0);
    expect(task.state).toBe('preparing');

    queue.enable();
    await sleep(0);
    expect(task.state).toBe('running');

    task.completeRun();
    await queue.waitUntilFinished();
    expect(task.state).toBe('completed');
  });
  test('running中にpauseすると再生を一時停止する。enableすると再開する', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    task.completePrepare(false);
    queue.runNext();
    await sleep(0);
    expect(task.state).toBe('running');

    await queue.disable({ interruptAction: 'pause' });
    expect(task.state).toBe('paused');

    queue.enable();
    expect(task.state).toBe('running');

    task.completeRun();
    await queue.waitUntilFinished();
    expect(task.state).toBe('completed');
  });
  test('pause中にdisableすると再生をキャンセルする', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    task.completePrepare(false);
    queue.runNext();
    await sleep(0);
    expect(task.state).toBe('running');

    await queue.disable({ interruptAction: 'pause' });
    expect(task.state).toBe('paused');

    await queue.disable({ interruptAction: 'cancel' });
    expect(task.state).toBe('canceled');
  });
  test('prepare中にcancelし、prepare完了後にステートを進めても再生しない', async () => {
    const queue = new QueueRunner();
    const task = new Task();
    queue.add(task.prepare, 'one');
    queue.runNext();
    await sleep(0);
    expect(task.state).toBe('preparing'); // queue.preparing に乗っている状態

    await queue.cancel(); // queue.preparing.cancel がセットされる

    // queue.preparing から queue.runningState に進む。queue.preparing.cancel が引き継がれる
    queue.runNext();

    await sleep(0);
    task.completePrepare(false);
    // prepareが終わったが、 cancel がセットされているので再生されない

    await sleep(0);
    expect(task.state).toBe('canceled');
  });

  test('running中にdisable({interruptAction: graceful})すると、再生が終わるまで続行したあとdisable状態になる', async () => {
    const queue = new QueueRunner();
    const task1 = new Task();
    queue.add(task1.prepare, 'one');
    const task2 = new Task();
    queue.add(task2.prepare, 'two');

    queue.runNext();
    await sleep(0);
    task1.completePrepare(false);
    await sleep(0);
    expect(task1.state).toBe('running');
    expect(queue.length).toBe(1);

    await queue.disable({ interruptAction: 'graceful' });
    expect(task1.state).toBe('running');
    expect(queue.state).toBe('disabled');

    task1.completeRun();
    await sleep(0);

    queue.runNext(); // 念のため
    await sleep(0);

    expect(task1.state).toBe('completed');
    expect(task2.state).toBe('idle');
    expect(queue.state).toBe('disabled');
    expect(queue.length).toBe(1);
  });

  describe('nextLabel', () => {
    test('キューに追加すると nextLabel がセットされる', () => {
      const queue = new QueueRunner();
      const states: any[] = [];
      queue.state$.subscribe((state) => states.push(state));

      const task = new Task();
      queue.add(task.prepare, 'test-label');

      const lastState = states[states.length - 1];
      expect(lastState.nextLabel).toBe('test-label');
    });

    test('キューが空のとき nextLabel は null', () => {
      const queue = new QueueRunner();
      const states: any[] = [];
      queue.state$.subscribe((state) => states.push(state));

      expect(states[0].nextLabel).toBe(null);
    });

    test('disable 中でもキューの先頭アイテムの nextLabel が取得できる', async () => {
      const queue = new QueueRunner();
      const states: any[] = [];
      queue.state$.subscribe((state) => states.push(state));

      const task1 = new Task();
      queue.add(task1.prepare, 'first');
      const task2 = new Task();
      queue.add(task2.prepare, 'second');

      queue.runNext();
      await sleep(0);
      task1.completePrepare(false);
      await sleep(0);

      // task1 が running 中に disable
      await queue.disable({ interruptAction: 'graceful' });

      const lastState = states[states.length - 1];
      expect(lastState.nextLabel).toBe('second');
      expect(lastState.disabled).toBe(true);
    });

    test('cancelQueue すると nextLabel が null になる', async () => {
      const queue = new QueueRunner();
      const states: any[] = [];
      queue.state$.subscribe((state) => states.push(state));

      const task1 = new Task();
      queue.add(task1.prepare, 'first');
      const task2 = new Task();
      queue.add(task2.prepare, 'second');

      queue.cancelQueue();

      const lastState = states[states.length - 1];
      expect(lastState.nextLabel).toBe(null);
      expect(lastState.length).toBe(0);
    });
  });
});
