import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { WaitNotify } from './WaitNotify';

type StartRecordCommon = {
  cancel: () => Promise<void>;
  running: Promise<void>;
};
type StartRecordPauseable = StartRecordCommon & {
  pause: () => void;
  resume: () => void;
};
export type StartRecord = StartRecordCommon | StartRecordPauseable;
function canPause(r: StartRecord): r is StartRecordPauseable {
  return 'pause' in r;
}

export type StartFunc = () => Promise<StartRecord | null>;
export type PrepareFunc = () => Promise<StartFunc | null>;

export type QueueRunnerState = {
  length: number;
  state: 'preparing' | 'running' | 'disabled' | null;
  disabled: boolean;
  nextLabel: string | null;
};

export class QueueRunner {
  private queue: {
    prepare: PrepareFunc;
    label: string;
  }[] = [];
  private preparing: {
    preparing: Promise<StartFunc>;
    cancel: boolean;
    label: string;
  } | null = null;
  private runningState: {
    cancel: () => Promise<void>;
    pause: () => void;
    resume: () => void;
    running: Promise<void>;
    state: 'preparing' | 'running';
  } | null = null;
  private _disabled: boolean = false;
  get disabled() {
    return this._disabled;
  }

  private readonly stateSubject: BehaviorSubject<QueueRunnerState>;
  public readonly state$: Observable<QueueRunnerState>;

  private notifyStateChange() {
    this.stateSubject.next({
      length: this.length,
      state: this.state,
      disabled: this.disabled,
      nextLabel: this.queue.length > 0 ? this.queue[0].label : null,
    });
  }

  runNext() {
    if (!this._disabled) {
      setTimeout(() => this._run(), 0);
    }
  }
  private finishNotifier = new WaitNotify();
  private logCallback: (obj: { state: string; label: string }) => void;

  constructor(
    options: {
      log?: (obj: { state: string; label: string }) => void;
    } = {},
  ) {
    this.logCallback = options.log || undefined;
    this.stateSubject = new BehaviorSubject({
      length: this.length,
      state: this.state,
      disabled: this.disabled,
      nextLabel: null,
    });
    this.state$ = this.stateSubject
      .asObservable()
      .pipe(
        distinctUntilChanged(
          (a, b) =>
            a.length === b.length &&
            a.state === b.state &&
            a.disabled === b.disabled &&
            a.nextLabel === b.nextLabel,
        ),
      );
  }

  log(state: string, label: string) {
    if (this.logCallback) {
      this.logCallback({ state, label });
    }
  }

  private async _run() {
    if (this._disabled) {
      return;
    }
    if (!this.preparing) {
      const next = this.queue.shift();
      this.notifyStateChange();
      if (next) {
        const { prepare, label } = next;
        const preparing = prepare().then(async start => {
          if (this.preparing?.cancel) {
            this.log('prepare canceled', label);
            if (start) {
              const { cancel } = await start();
              cancel();
            }
            return null;
          } else {
            if (start) {
              this.log('prepared', label);
              return start;
            } else {
              this.log('prepared null', label);
              return null;
            }
          }
        });
        this.preparing = {
          preparing,
          label,
          cancel: false,
        };
        this.notifyStateChange();
        preparing.then(start => {
          if (!start) {
            this._run();
          } else {
            if (!this.runningState) {
              this._run();
            }
          }
        });
      } else {
        if (!this.runningState) {
          this.finishNotifier.notify();
        }
      }
      return;
    }
    if (!this.runningState && this.preparing) {
      const { preparing, label, cancel: cancelPreparing } = this.preparing;
      this.preparing = null;
      this.notifyStateChange();
      let earlyCancel = cancelPreparing;
      let resolveRunning2: () => void = () => {};
      const running2 = new Promise<void>(resolve => {
        resolveRunning2 = resolve;
      });
      running2.then(() => {
        this.log('finished', label);
        this.runningState = null;
        this.notifyStateChange();
        this.runNext();
      });
      this.runningState = {
        cancel: async () => {
          this.runningState.cancel = async () => {
            await running2;
          };
          earlyCancel = true;
          await running2;
        },
        pause: () => {},
        resume: () => {},
        running: running2,
        state: 'preparing',
      };
      this.notifyStateChange();
      this.log('preparing', label);
      preparing
        .then(start => {
          return start ? start() : null;
        })
        .then(r => {
          if (!r) {
            this.log('not started', label);
            resolveRunning2();
          } else {
            const { cancel, running } = r;
            if (earlyCancel) {
              this.log('early cancel', label);
              cancel().then(() => {
                resolveRunning2();
              });
            } else {
              this.log('running', label);
              this.runningState = {
                cancel: async () => {
                  this.runningState.cancel = async () => {
                    await running2;
                  };
                  await cancel();
                  await running2;
                },
                pause: () => {
                  if (canPause(r)) {
                    r.pause();
                  }
                },
                resume: () => {
                  if (canPause(r)) {
                    r.resume();
                  }
                },
                running: running.then(() => {
                  resolveRunning2();
                }),
                state: 'running',
              };
              this.notifyStateChange();
            }
          }
        });
    }
  }

  cancelQueue() {
    // 実行中のものはキャンセルしない
    this.queue = [];
    if (this.preparing) {
      // 準備中ならキャンセルする
      this.preparing.cancel = true;
    }
    this.notifyStateChange();
  }

  async cancel() {
    // 実行中のものはキャンセルし、キューに残っているものは削除する
    this.cancelQueue();
    if (this.runningState) {
      await this.runningState.cancel();
    }
  }

  get isRunning(): boolean {
    return this.runningState !== null || this.preparing !== null || this.queue.length > 0;
  }

  async waitUntilFinished(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    return this.finishNotifier.wait();
  }

  /**
   * キューの進行を停止する
   * @param options interruptAction: 'pause'なら、実行中のものを pause する。'cancel' ならキャンセル、 'graceful'(デフォルト)なら何もしない
   */
  async disable(options: { interruptAction?: 'pause' | 'cancel' | 'graceful' } = {}) {
    // pause後の場合再度disableできるので、既にdisable中であっても実行する

    if (this.runningState) {
      if (this.runningState.state === 'running') {
        switch (options.interruptAction) {
          case 'pause':
            if (this.runningState.pause) {
              this.runningState.pause();
            }
            break;
          case 'cancel':
            await this.runningState.cancel();
            break;
          case 'graceful':
            // 現在実行中のものは最後まで実行する
            break;
        }
      }
    }

    this._disabled = true;
    this.notifyStateChange();
  }

  /**
   * キューの進行を再開させる。pauseしていたなら再開する
   */
  enable() {
    if (!this._disabled) {
      return;
    }
    this._disabled = false;
    this.notifyStateChange();

    if (this.runningState) {
      if (this.runningState.state === 'running') {
        if (this.runningState.resume) {
          this.runningState.resume();
          return;
        }
      }
    }
    this.runNext();
  }

  /**
   *
   * @param prepare 準備を開始する関数。準備が完了したら、開始関数を返す。準備が失敗したらnullを返す。
   * @param label デバッグ表示用のラベル
   */
  add(prepare: PrepareFunc, label: string) {
    if (prepare) {
      this.queue.push({ prepare, label });
      this.notifyStateChange();
    }
  }

  get state(): 'preparing' | 'running' | 'disabled' | null {
    if (this._disabled) {
      return 'disabled';
    }
    if (this.runningState) {
      return this.runningState.state;
    }
    if (this.preparing) {
      return 'preparing';
    }
    return null;
  }

  get length(): number {
    return this.queue.length + (this.preparing ? 1 : 0);
  }
}
