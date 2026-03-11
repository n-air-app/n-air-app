import * as FakeTimers from '@sinonjs/fake-timers';
import { Subject } from 'rxjs';
import type { AudioSource, IVolmeter } from 'services/audio';
import type { Source, TSourceType } from 'services/sources';
import { createSetupFunction } from 'util/test-setup';
import type { SoundDetectorService } from './sound-detector';

const setup = createSetupFunction({
  state: {
    SoundDetectorService: {},
  },
  injectee: {
    AudioService: {},
  },
});

jest.mock('services/audio', () => ({ AudioService: {} }));

beforeEach(() => {
  jest.doMock('services/core/stateful-service');
  jest.doMock('services/core/injector');
});

afterEach(() => {
  jest.resetModules();
});

function makeAudioSource({
  type,
  sourceId,
  name,
  stream,
  isMuted,
}: {
  type: TSourceType;
  sourceId: string;
  name: string;
  stream: Subject<IVolmeter>;
  isMuted?: () => boolean;
}): AudioSource {
  const audioSource = {
    sourceId,
    name,
    source: {
      type,
      sourceId,
      name,
      audio: true,
      video: false,
      muted: false,
    } as Source,
    getVolmeterStream: () => stream.asObservable(),
  } as AudioSource;
  Object.defineProperty(audioSource, 'muted', {
    get: () => (isMuted ? isMuted() : false),
    enumerable: true,
    configurable: true,
  });
  return audioSource;
}

function prepare(
  options: {
    speechActionOnSoundDetected?: 'pause' | 'cancel' | 'graceful';
    soundThresholdDb?: number;
    resumeSilenceMs?: number;
    noSignalTimeoutMs?: number;
  } = {},
) {
  // AudioService
  const audioSourcesChanged = new Subject<void>();
  const muteChanged = new Subject<{ sourceId: string; muted: boolean }>();
  const mutedSources = new Set<string>();
  const micStream = new Subject<IVolmeter>();
  const micSource = makeAudioSource({
    sourceId: 'mic',
    name: 'マイク',
    type: 'wasapi_input_capture',
    stream: micStream,
    isMuted: () => mutedSources.has('mic'),
  });
  const rtvcStream = new Subject<IVolmeter>();
  const rtvcSource = makeAudioSource({
    name: 'RTVC',
    sourceId: 'rtvc',
    type: 'nair-rtvc-source',
    stream: rtvcStream,
    isMuted: () => mutedSources.has('rtvc'),
  });
  const mute = (sourceId: string, muted: boolean) => {
    if (mutedSources.has(sourceId) === muted) {
      return;
    }
    mutedSources[muted ? 'add' : 'delete'](sourceId);
    muteChanged.next({ sourceId, muted });
  };
  const isMuted = (sourceId: string) => mutedSources.has(sourceId);

  const stateOverride: Record<string, Record<string, unknown>> = {};
  if (
    options.speechActionOnSoundDetected !== undefined ||
    options.soundThresholdDb !== undefined ||
    options.resumeSilenceMs !== undefined ||
    options.noSignalTimeoutMs !== undefined
  ) {
    stateOverride.SoundDetectorService = {};
    if (options.speechActionOnSoundDetected !== undefined) {
      stateOverride.SoundDetectorService.speechActionOnSoundDetected =
        options.speechActionOnSoundDetected;
    }
    if (options.soundThresholdDb !== undefined) {
      stateOverride.SoundDetectorService.soundThresholdDb = options.soundThresholdDb;
    }
    if (options.resumeSilenceMs !== undefined) {
      stateOverride.SoundDetectorService.resumeSilenceMs = options.resumeSilenceMs;
    }
    if (options.noSignalTimeoutMs !== undefined) {
      stateOverride.SoundDetectorService.noSignalTimeoutMs = options.noSignalTimeoutMs;
    }
  }

  setup({
    state: stateOverride,
    injectee: {
      AudioService: {
        audioSourcesChanged,
        muteChanged,
        getVisibleSourcesForCurrentScene(): AudioSource[] {
          return [micSource, rtvcSource];
        },
        getSource(sourceId: string): { muted: boolean } {
          return { muted: mutedSources.has(sourceId) };
        },
      },
    },
  });

  const { SoundDetectorService } = require('./sound-detector');
  const instance = SoundDetectorService.instance as SoundDetectorService;

  instance.enable();

  return {
    instance,

    // AudioService
    audioSourcesChanged,
    micStream,
    rtvcStream,
    mute,
    isMuted,
  };
}

describe('SoundDetectorService', () => {
  // FakeTimersを使って時間を操作する
  let clock: FakeTimers.InstalledClock;
  beforeEach(() => {
    clock = FakeTimers.install();
  });
  afterEach(() => {
    clock.uninstall();
  });

  test('getAvailableSources', () => {
    const { instance } = prepare();
    const sources = instance.getAvailableSources();
    expect(sources).toHaveLength(2);
    expect(sources.map(s => s.name)).toEqual(['マイク', 'RTVC']);
  });

  test('soundDetectedSubject', () => {
    const { instance, micStream } = prepare();

    let soundDetected = false;
    instance.soundDetectedObservable.subscribe(({ soundDetected: detected }) => {
      soundDetected = detected === 'loud';
    });

    const threshold = instance.state.soundThresholdDb;
    const low = threshold;
    const high = threshold + 1;

    // マイクからの音量がしきい値を超えたらtrue
    micStream.next({ peak: [low] } as IVolmeter);
    expect(soundDetected).toBe(false);
    micStream.next({ peak: [high] } as IVolmeter);
    expect(soundDetected).toBe(true);

    // 閾値を下回ってもすぐにはfalseにならない
    micStream.next({ peak: [low] } as IVolmeter);
    expect(soundDetected).toBe(true);

    // resumeSilenceMs経過後にfalse
    clock.tick(instance.state.resumeSilenceMs);
    expect(soundDetected).toBe(false);
  });

  // 音声がまったく来ない状態が NoSignalTimeoutMs 続いたら soundDetectedSubject に no-signal が通知される
  test('no-signal', () => {
    const { instance, micStream } = prepare();

    let noSignalDetected = false;
    instance.soundDetectedObservable.subscribe(({ soundDetected: detected }) => {
      noSignalDetected = detected === 'no-signal';
    });

    micStream.next({ peak: [0] } as IVolmeter);
    expect(noSignalDetected).toBe(false);

    clock.tick(instance.state.noSignalTimeoutMs);
    expect(noSignalDetected).toBe(true);
  });

  test('mute が sourceMuted に通知される', () => {
    const { instance, mute, isMuted } = prepare();
    // defaultで micとrtvc が購読されている

    // 初期状態でどちらもミュートされていない
    expect(isMuted('mic')).toBe(false);
    expect(isMuted('rtvc')).toBe(false);

    let sourceMuted = false;
    instance.sourceMuted.subscribe(muted => {
      sourceMuted = muted;
    });
    expect(sourceMuted).toBe(false);

    // すべてがミュートされたときだけ sourceMuted が true になる
    mute('mic', true);
    expect(sourceMuted).toBe(false);
    mute('rtvc', true);
    expect(sourceMuted).toBe(true);
    mute('mic', false);
    expect(sourceMuted).toBe(false);
    mute('rtvc', false);
    expect(sourceMuted).toBe(false);
  });

  test('監視対象のソースが存在しない場合 sourceMuted は false になる', () => {
    const { instance } = prepare();

    let sourceMuted: boolean;
    instance.sourceMuted.subscribe(muted => {
      sourceMuted = muted;
    });

    // 空のソースリストで subscribeAudioSource を呼ぶ（シーン切り替えで対象ソースがない場合を再現）
    instance.subscribeAudioSource([]);
    expect(sourceMuted).toBe(false);
  });

  describe('sourceAvailable', () => {
    test('sourceId が mic の場合は常に true', () => {
      // sourceId='mic' はデフォルト値
      const { instance } = prepare();

      let sourceAvailable: boolean;
      instance.sourceAvailable.subscribe(available => {
        sourceAvailable = available;
      });

      expect(sourceAvailable).toBe(true);
    });

    test('特定ソースが存在する場合は true', () => {
      const audioSourcesChanged = new Subject<void>();
      const muteChanged = new Subject<{ sourceId: string; muted: boolean }>();
      const micStream = new Subject<IVolmeter>();
      const micSource = makeAudioSource({
        sourceId: 'mic',
        name: 'マイク',
        type: 'wasapi_input_capture',
        stream: micStream,
      });

      const availableSources: AudioSource[] = [micSource];

      setup({
        state: { SoundDetectorService: { sourceId: 'mic' } },
        injectee: {
          AudioService: {
            audioSourcesChanged,
            muteChanged,
            getVisibleSourcesForCurrentScene: () => availableSources,
            getSource: (sourceId: string) => ({ muted: false }),
          },
        },
      });

      const { SoundDetectorService } = require('./sound-detector');
      const instance = SoundDetectorService.instance as SoundDetectorService;
      instance.enable();

      let sourceAvailable: boolean;
      instance.sourceAvailable.subscribe(available => {
        sourceAvailable = available;
      });

      // 特定ソースを選択
      instance.updateSourceId('mic');
      expect(sourceAvailable).toBe(true);
    });

    test('選択中のソースがシーン切り替えで消えた場合は false になる', () => {
      const audioSourcesChanged = new Subject<void>();
      const muteChanged = new Subject<{ sourceId: string; muted: boolean }>();
      const micStream = new Subject<IVolmeter>();
      const micSource = makeAudioSource({
        sourceId: 'specific-mic',
        name: 'マイク(特定)',
        type: 'wasapi_input_capture',
        stream: micStream,
      });

      let availableSources: AudioSource[] = [micSource];

      setup({
        state: { SoundDetectorService: { sourceId: 'specific-mic' } },
        injectee: {
          AudioService: {
            audioSourcesChanged,
            muteChanged,
            getVisibleSourcesForCurrentScene: () => availableSources,
            getSource: (sourceId: string) => ({ muted: false }),
          },
        },
      });

      const { SoundDetectorService } = require('./sound-detector');
      const instance = SoundDetectorService.instance as SoundDetectorService;
      instance.enable();

      let sourceAvailable: boolean;
      instance.sourceAvailable.subscribe(available => {
        sourceAvailable = available;
      });

      // 初期状態: ソースが存在する
      expect(sourceAvailable).toBe(true);

      // シーン切り替えでソースが消える
      availableSources = [];
      audioSourcesChanged.next();
      expect(sourceAvailable).toBe(false);

      // 元のシーンに戻ってソースが復活
      availableSources = [micSource];
      audioSourcesChanged.next();
      expect(sourceAvailable).toBe(true);
    });
  });

  describe('init() の不正値補正', () => {
    const defaultState = {
      soundThresholdDb: -19,
      resumeSilenceMs: 500,
      noSignalTimeoutMs: 1000,
    };

    describe('soundThresholdDb', () => {
      test.each([
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['-Infinity', -Infinity],
        ['範囲外(正の値)', 1],
        ['範囲外(-96未満)', -100],
      ])('%s はデフォルト値にリセットされる', (_label, value) => {
        const { instance } = prepare({ soundThresholdDb: value });
        expect(instance.state.soundThresholdDb).toBe(defaultState.soundThresholdDb);
      });

      test.each([
        ['下限値', -96],
        ['上限値', 0],
        ['通常値', -19],
      ])('%s はそのまま保持される', (_label, value) => {
        const { instance } = prepare({ soundThresholdDb: value });
        expect(instance.state.soundThresholdDb).toBe(value);
      });
    });

    describe('resumeSilenceMs', () => {
      test.each([
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['0', 0],
        ['負の値', -1],
      ])('%s はデフォルト値にリセットされる', (_label, value) => {
        const { instance } = prepare({ resumeSilenceMs: value });
        expect(instance.state.resumeSilenceMs).toBe(defaultState.resumeSilenceMs);
      });

      test.each([
        ['最小有効値(1)', 1],
        ['通常値', 500],
      ])('%s はそのまま保持される', (_label, value) => {
        const { instance } = prepare({ resumeSilenceMs: value });
        expect(instance.state.resumeSilenceMs).toBe(value);
      });
    });

    describe('noSignalTimeoutMs', () => {
      test.each([
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['0', 0],
        ['負の値', -1],
      ])('%s はデフォルト値にリセットされる', (_label, value) => {
        const { instance } = prepare({ noSignalTimeoutMs: value });
        expect(instance.state.noSignalTimeoutMs).toBe(defaultState.noSignalTimeoutMs);
      });

      test.each([
        ['最小有効値(1)', 1],
        ['通常値', 1000],
      ])('%s はそのまま保持される', (_label, value) => {
        const { instance } = prepare({ noSignalTimeoutMs: value });
        expect(instance.state.noSignalTimeoutMs).toBe(value);
      });
    });

    // loud 状態中に resumeSilenceMs を変更しても silence が emit されないことを確認
    test('loud 状態中に resumeSilenceMs を変更しても silence に戻らない', () => {
      const { instance, micStream } = prepare();

      const states: string[] = [];
      instance.soundDetectedObservable.subscribe(({ soundDetected }) => {
        states.push(soundDetected);
      });

      const high = instance.state.soundThresholdDb + 1;
      micStream.next({ peak: [high] } as IVolmeter);
      expect(states.at(-1)).toBe('loud');

      // loud 状態中に resumeSilenceMs を変更
      instance.updateResumeSilenceMs(2000);
      // silence が emit されていないこと
      expect(states.at(-1)).toBe('loud');
    });

    test('loud 状態中に resumeSilenceMs を変更すると変更後の時間で silence になる', () => {
      const { instance, micStream } = prepare();

      const states: string[] = [];
      instance.soundDetectedObservable.subscribe(({ soundDetected }) => {
        states.push(soundDetected);
      });

      const high = instance.state.soundThresholdDb + 1;
      micStream.next({ peak: [high] } as IVolmeter);
      expect(states.at(-1)).toBe('loud');

      // loud 状態中に resumeSilenceMs を 2000ms に変更（デフォルト 500ms より長い）
      instance.updateResumeSilenceMs(2000);

      // 旧 resumeSilenceMs (500ms) 経過後もまだ loud のまま
      clock.tick(500);
      expect(states.at(-1)).toBe('loud');

      // 新 resumeSilenceMs (2000ms) 経過後に silence になる
      clock.tick(1500);
      expect(states.at(-1)).toBe('silence');
    });

    // resumeSilenceMs=0 の場合に silence/loud の高速振動が起きないことを確認
    // (0 を設定しようとしてもデフォルト値にリセットされるため振動は発生しない)
    test('resumeSilenceMs=0 の設定値は補正されるため高速振動しない', () => {
      const { instance, micStream } = prepare({ resumeSilenceMs: 0 });

      const states: string[] = [];
      instance.soundDetectedObservable.subscribe(({ soundDetected }) => {
        states.push(soundDetected);
      });

      const high = instance.state.soundThresholdDb + 1;
      micStream.next({ peak: [high] } as IVolmeter);
      // loud になる
      expect(states.at(-1)).toBe('loud');

      // resumeSilenceMs が正常値(500ms)に補正されているため、時間経過前は silence に戻らない
      clock.tick(1);
      expect(states.at(-1)).toBe('loud');

      // 正常な resumeSilenceMs 後に silence になる
      clock.tick(instance.state.resumeSilenceMs - 1);
      expect(states.at(-1)).toBe('silence');
    });
  });

  describe('markDeclined', () => {
    test('declined=true かつ enabled=false になること', () => {
      const { instance } = prepare();
      instance.markDeclined();
      expect(instance.state.declined).toBe(true);
      expect(instance.state.enabled).toBe(false);
    });
  });

  describe('isBlockingObservable', () => {
    test('pause の場合は loud でブロックする', () => {
      const { instance, micStream } = prepare({ speechActionOnSoundDetected: 'pause' });

      let isBlocking = false;
      instance.isBlockingObservable.subscribe(blocking => {
        isBlocking = blocking;
      });

      const threshold = instance.state.soundThresholdDb;
      const high = threshold + 1;
      const low = threshold;

      // 初期状態ではブロックしていない
      expect(isBlocking).toBe(false);

      // 音量がしきい値を超えたらブロック
      micStream.next({ peak: [high] } as IVolmeter);
      expect(isBlocking).toBe(true);

      // 音量が下がってもすぐにはブロック解除されない
      micStream.next({ peak: [low] } as IVolmeter);
      expect(isBlocking).toBe(true);

      // resumeSilenceMs経過後にブロック解除
      clock.tick(instance.state.resumeSilenceMs);
      expect(isBlocking).toBe(false);
    });

    test('cancel の場合は loud でブロックする', () => {
      const { instance, micStream } = prepare({ speechActionOnSoundDetected: 'cancel' });

      let isBlocking = false;
      instance.isBlockingObservable.subscribe(blocking => {
        isBlocking = blocking;
      });

      const threshold = instance.state.soundThresholdDb;
      const high = threshold + 1;

      expect(isBlocking).toBe(false);
      micStream.next({ peak: [high] } as IVolmeter);
      expect(isBlocking).toBe(true);
    });

    test('graceful の場合は loud でもブロックしない', () => {
      const { instance, micStream } = prepare({ speechActionOnSoundDetected: 'graceful' });

      let isBlocking = false;
      instance.isBlockingObservable.subscribe(blocking => {
        isBlocking = blocking;
      });

      const threshold = instance.state.soundThresholdDb;
      const high = threshold + 1;
      const low = threshold;

      // 初期状態ではブロックしていない
      expect(isBlocking).toBe(false);

      // graceful の場合は loud でもブロックしない
      micStream.next({ peak: [high] } as IVolmeter);
      expect(isBlocking).toBe(false);

      // silence に戻ってもブロックしない
      micStream.next({ peak: [low] } as IVolmeter);
      clock.tick(instance.state.resumeSilenceMs);
      expect(isBlocking).toBe(false);
    });

    test('speechActionOnSoundDetected による動作の違いを確認', () => {
      // pause の場合
      const pauseTest = prepare({ speechActionOnSoundDetected: 'pause' });
      let pauseBlocking = false;
      pauseTest.instance.isBlockingObservable.subscribe(blocking => {
        pauseBlocking = blocking;
      });
      pauseTest.micStream.next({ peak: [pauseTest.instance.state.soundThresholdDb + 1] } as IVolmeter);
      expect(pauseBlocking).toBe(true);

      jest.resetModules();

      // graceful の場合
      const gracefulTest = prepare({ speechActionOnSoundDetected: 'graceful' });
      let gracefulBlocking = false;
      gracefulTest.instance.isBlockingObservable.subscribe(blocking => {
        gracefulBlocking = blocking;
      });
      gracefulTest.micStream.next({ peak: [gracefulTest.instance.state.soundThresholdDb + 1] } as IVolmeter);
      expect(gracefulBlocking).toBe(false);

      jest.resetModules();

      // cancel の場合
      const cancelTest = prepare({ speechActionOnSoundDetected: 'cancel' });
      let cancelBlocking = false;
      cancelTest.instance.isBlockingObservable.subscribe(blocking => {
        cancelBlocking = blocking;
      });
      cancelTest.micStream.next({ peak: [cancelTest.instance.state.soundThresholdDb + 1] } as IVolmeter);
      expect(cancelBlocking).toBe(true);
    });
  });
});
