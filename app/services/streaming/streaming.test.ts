import * as remote from '@electron/remote';
import { EncoderFamily, OptimizedSettings } from 'services/settings/optimizer';
import { RequestError } from 'util/RequestError';
import { createSetupFunction } from 'util/test-setup';

import { NicoliveProgramStateService } from '../nicolive-program/state';

import { ERecordingState, EStreamingState } from './streaming-api';

function noop(..._args: any[]) {}

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('../../../obs-api', () => ({
  NodeObs: {
    OBS_service_startStreaming: noop,
    OBS_service_stopStreaming: noop,
    OBS_service_connectOutputSignals: noop,
  },
}));
jest.mock('services/settings', () => ({}));
jest.mock('services/windows', () => ({}));
jest.mock('services/usage-statistics', () => ({}));
jest.mock('services/i18n', () => ({
  $t: (x: any) => x,
}));
jest.mock('@electron/remote', () => ({
  BrowserWindow: jest.fn(),
  getCurrentWindow: jest.fn(),
  powerSaveBlocker: {
    start: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn().mockImplementation(async () => ({ response: 0 })),
  },
}));
jest.mock('services/customization', () => ({}));
jest.mock('services/user', () => ({}));
jest.mock('util/menus/Menu', () => ({}));
jest.mock('services/nicolive-program/nicolive-program', () => ({}));
jest.mock('services/nicolive-program/nicolive-comment-synthesizer', () => ({}));
jest.mock('services/custom-cast-usage', () => ({}));
jest.mock('services/nvoice-character-usage', () => ({}));
const showWindow = jest.fn();

const createInjectee = ({
  recordEvent = noop,
  generateStreamingTrackID = noop,
  getStreamEncoderSettings = () => {
    return {
      streamingURL: 'rtmp://service.domain/path',
      encoder: '',
      preset: '',
      profile: '',
      bitrate: '',
      baseResolution: '',
      outputResolution: '',
      fps: '',
      audio: {
        bitrate: '',
        sampleRate: 48000,
        rateControl: null,
      } as any,
    };
  },
  WarnBeforeStartingStream = false,
  WarnBeforeStoppingStream = false,
  RecordWhenStreaming = false,
  KeepRecordingWhenStreamStops = true,
  isNiconicoLoggedIn = false,
  updateStreamSettings = noop,
  optimizeForNiconico = false,
} = {}) => ({
  SettingsService: {
    state: {
      General: {
        WarnBeforeStartingStream,
        WarnBeforeStoppingStream,
        RecordWhenStreaming,
        KeepRecordingWhenStreamStops,
      },
    },
    getStreamEncoderSettings,
  },
  UserService: {
    isNiconicoLoggedIn() {
      return isNiconicoLoggedIn;
    },
    updateStreamSettings,
    isLoggedIn() {
      return isNiconicoLoggedIn;
    },
  },
  UsageStatisticsService: {
    recordEvent,
    generateStreamingTrackID,
    uuidService: { uuid: 'test-uuid' },
  },
  CustomizationService: {
    state: {
      autoCompactMode: false,
    },
    optimizeForNiconico,
  },
  WindowsService: {
    showWindow,
  },
  NicoliveCommentSynthesizerService: {},
  NicoliveProgramService: {
    state: {
      programID: '',
    },
    fetchProgram: noop,
  },
  VideoSettingsService: {
    contexts: { horizontal: '' },
  },
  CustomcastUsageService: {
    state: {
      isCustomcastUsed: false,
      programID: '',
    },
    startStreaming: noop,
    stopStreaming: noop,
  },
  RtvcStateService: {
    startStreaming: noop,
    stopStreaming: noop,
  },
  NicoliveProgramStateService: {
    state: NicoliveProgramStateService.defaultState,
  },
  SubStreamService: {
    state: noop,
    syncStart: noop,
    syncStop: noop,
  },
  TranscriptionService: {
    state: noop,
    startStreaming: noop,
    stopStreaming: noop,
  },
  SoundDetectorService: {
    getActionLog: () => ({
      enabled: false,
      sourceId: 'mic',
      soundThresholdDb: -19,
      resumeSilenceMs: 500,
      speechActionOnSoundDetected: 'graceful',
    }),
  },
  NVoiceCharacterUsageService: {
    startStreaming: noop,
    getActionLog: () => ({ used: false, standing1: false, standing2: false }),
  },
});

const setup = createSetupFunction({
  injectee: createInjectee(),
});

beforeEach(() => {
  /**
   * jest.spyOnをリセット
   * @see https://jestjs.io/docs/ja/jest-object#jestrestoreallmocks
   **/
  jest.restoreAllMocks();

  jest.resetModules();
});

test('get instance', () => {
  setup();
  const { StreamingService } = require('./streaming');
  expect(StreamingService.instance()).toBeInstanceOf(StreamingService);
});

test('toggleStreamingでstreamingStatusがofflineの場合', () => {
  const OBS_service_startStreaming = jest.fn();
  const OBS_service_stopStreaming = jest.fn();
  const OBS_service_setVideoInfo = jest.fn();

  jest.mock('../../../obs-api', () => ({
    NodeObs: {
      OBS_service_startStreaming,
      OBS_service_stopStreaming,
      OBS_service_connectOutputSignals: noop,
      OBS_service_setVideoInfo,
    },
  }));

  setup({
    injectee: createInjectee(),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.toggleRecording = jest.fn();
  instance.toggleStreaming();
  instance.handleOBSOutputSignal({ type: 'streaming', signal: 'start' });

  expect(instance.toggleRecording).not.toHaveBeenCalled();
  expect(OBS_service_startStreaming).toHaveBeenCalledTimes(1);
  expect(OBS_service_stopStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingでstreamingStatusがoffline、配信開始時に確認して、配信開始をやめる場合', () => {
  const OBS_service_startStreaming = jest.fn();
  const OBS_service_stopStreaming = jest.fn();
  const OBS_service_setVideoInfo = jest.fn();

  jest.mock('../../../obs-api', () => ({
    NodeObs: {
      OBS_service_startStreaming,
      OBS_service_stopStreaming,
      OBS_service_connectOutputSignals: noop,
      OBS_service_setVideoInfo,
    },
  }));

  setup({
    injectee: createInjectee({
      WarnBeforeStartingStream: true,
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.toggleRecording = jest.fn();
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  instance.toggleStreaming();

  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(instance.toggleRecording).not.toHaveBeenCalled();
  expect(OBS_service_startStreaming).not.toHaveBeenCalled();
  expect(OBS_service_stopStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingでstreamingStatusがoffline、配信開始時に確認して、配信を始める場合', () => {
  const OBS_service_startStreaming = jest.fn();
  const OBS_service_stopStreaming = jest.fn();
  const OBS_service_setVideoInfo = jest.fn();

  jest.mock('../../../obs-api', () => ({
    NodeObs: {
      OBS_service_startStreaming,
      OBS_service_stopStreaming,
      OBS_service_connectOutputSignals: noop,
      OBS_service_setVideoInfo,
    },
  }));

  setup({
    injectee: createInjectee({
      WarnBeforeStartingStream: true,
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.toggleRecording = jest.fn();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  instance.toggleStreaming();
  instance.handleOBSOutputSignal({ type: 'streaming', signal: 'start' });

  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(instance.toggleRecording).not.toHaveBeenCalled();
  expect(OBS_service_startStreaming).toHaveBeenCalledTimes(1);
  expect(OBS_service_stopStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingでstreamingStatusがoffline、配信開始と同時に録画開始する場合', () => {
  const OBS_service_startStreaming = jest.fn();
  const OBS_service_stopStreaming = jest.fn();
  const OBS_service_connectOutputSignals = jest.fn();
  const OBS_service_setVideoInfo = jest.fn();

  jest.mock('../../../obs-api', () => ({
    NodeObs: {
      OBS_service_startStreaming,
      OBS_service_stopStreaming,
      OBS_service_connectOutputSignals,
      OBS_service_setVideoInfo,
    },
  }));

  setup({
    injectee: createInjectee({
      RecordWhenStreaming: true,
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  expect(OBS_service_connectOutputSignals).toHaveBeenCalledTimes(1);
  const handler = OBS_service_connectOutputSignals.mock.calls[0][0];

  instance.toggleRecording = jest.fn();
  instance.toggleStreaming();
  expect(typeof handler).toBe('function');
  handler({ type: 'streaming', signal: 'start' });

  expect(instance.toggleRecording).toHaveBeenCalledTimes(1);
  expect(OBS_service_startStreaming).toHaveBeenCalledTimes(1);
  expect(OBS_service_stopStreaming).not.toHaveBeenCalled();
});

[EStreamingState.Starting, EStreamingState.Live, EStreamingState.Reconnecting].forEach(
  (streamingStatus) => {
    test(`toggleStreamingでstreamingStatusが${streamingStatus}の場合`, () => {
      const OBS_service_startStreaming = jest.fn();
      const OBS_service_stopStreaming = jest.fn();

      jest.mock('../../../obs-api', () => ({
        NodeObs: {
          OBS_service_startStreaming,
          OBS_service_stopStreaming,
          OBS_service_connectOutputSignals: noop,
        },
      }));

      setup({
        injectee: createInjectee({}),
        state: {
          StreamingService: {
            streamingStatus,
            recordingStatus: ERecordingState.Offline,
          },
        },
      });

      const { StreamingService } = require('./streaming');
      const instance = StreamingService.instance();

      instance.toggleRecording = jest.fn();
      instance.toggleStreaming();

      expect(instance.toggleRecording).not.toHaveBeenCalled();
      expect(OBS_service_startStreaming).not.toHaveBeenCalled();
      expect(OBS_service_stopStreaming).toHaveBeenCalledTimes(1);
      expect(OBS_service_stopStreaming).toHaveBeenCalledWith(false);
    });

    test(`toggleStreamingでstreamingStatusが${streamingStatus}、配信終了前に確認して、配信終了をやめる場合`, () => {
      const OBS_service_startStreaming = jest.fn();
      const OBS_service_stopStreaming = jest.fn();

      jest.mock('../../../obs-api', () => ({
        NodeObs: {
          OBS_service_startStreaming,
          OBS_service_stopStreaming,
          OBS_service_connectOutputSignals: noop,
        },
      }));

      setup({
        injectee: createInjectee({
          WarnBeforeStoppingStream: true,
        }),
        state: {
          StreamingService: {
            streamingStatus,
            recordingStatus: ERecordingState.Offline,
          },
        },
      });

      const { StreamingService } = require('./streaming');
      const instance = StreamingService.instance();

      instance.toggleRecording = jest.fn();
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      instance.toggleStreaming();

      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(instance.toggleRecording).not.toHaveBeenCalled();
      expect(OBS_service_startStreaming).not.toHaveBeenCalled();
      expect(OBS_service_stopStreaming).not.toHaveBeenCalled();
    });

    test(`toggleStreamingでstreamingStatusが${streamingStatus}、配信終了前に確認して、配信終了する場合`, () => {
      const OBS_service_startStreaming = jest.fn();
      const OBS_service_stopStreaming = jest.fn();

      jest.mock('../../../obs-api', () => ({
        NodeObs: {
          OBS_service_startStreaming,
          OBS_service_stopStreaming,
          OBS_service_connectOutputSignals: noop,
        },
      }));

      setup({
        injectee: createInjectee({
          WarnBeforeStoppingStream: true,
        }),
        state: {
          StreamingService: {
            streamingStatus,
            recordingStatus: ERecordingState.Offline,
          },
        },
      });

      const { StreamingService } = require('./streaming');
      const instance = StreamingService.instance();

      instance.toggleRecording = jest.fn();
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      instance.toggleStreaming();

      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(instance.toggleRecording).not.toHaveBeenCalled();
      expect(OBS_service_startStreaming).not.toHaveBeenCalled();
      expect(OBS_service_stopStreaming).toHaveBeenCalledTimes(1);
      expect(OBS_service_stopStreaming).toHaveBeenCalledWith(false);
    });

    test(`toggleStreamingでstreamingStatusが${streamingStatus}、配信終了と同時に録画終了する場合`, () => {
      const OBS_service_startStreaming = jest.fn();
      const OBS_service_stopStreaming = jest.fn();

      jest.mock('../../../obs-api', () => ({
        NodeObs: {
          OBS_service_startStreaming,
          OBS_service_stopStreaming,
          OBS_service_connectOutputSignals: noop,
        },
      }));

      setup({
        injectee: createInjectee({
          KeepRecordingWhenStreamStops: false,
        }),
        state: {
          StreamingService: {
            streamingStatus,
            recordingStatus: ERecordingState.Recording,
          },
        },
      });

      const { StreamingService } = require('./streaming');
      const instance = StreamingService.instance();

      instance.toggleRecording = jest.fn();
      instance.toggleStreaming();

      expect(instance.toggleRecording).toHaveBeenCalledTimes(1);
      expect(OBS_service_startStreaming).not.toHaveBeenCalled();
      expect(OBS_service_stopStreaming).toHaveBeenCalledTimes(1);
      expect(OBS_service_stopStreaming).toHaveBeenCalledWith(false);
    });
  },
);

test('toggleStreamingでstreamingStatusがendingの場合', () => {
  const OBS_service_startStreaming = jest.fn();
  const OBS_service_stopStreaming = jest.fn();

  jest.mock('../../../obs-api', () => ({
    NodeObs: {
      OBS_service_startStreaming,
      OBS_service_stopStreaming,
      OBS_service_connectOutputSignals: noop,
    },
  }));

  setup({
    injectee: createInjectee({
      KeepRecordingWhenStreamStops: false,
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Ending,
        recordingStatus: ERecordingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.toggleRecording = jest.fn();

  instance.toggleStreaming();

  expect(instance.toggleRecording).not.toHaveBeenCalled();
  expect(OBS_service_startStreaming).not.toHaveBeenCalled();
  expect(OBS_service_stopStreaming).toHaveBeenCalledTimes(1);
  expect(OBS_service_stopStreaming).toHaveBeenCalledWith(true);
});

test('toggleStreamingAsyncでstreamingStatusがoffline以外の場合', async () => {
  setup({
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Live,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve('lv12345'));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  instance.toggleStreaming = jest.fn();

  await instance.toggleStreamingAsync();

  expect(instance.toggleStreaming).toHaveBeenCalledTimes(1);
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていない場合', async () => {
  setup({
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.toggleStreaming = jest.fn();

  await instance.toggleStreamingAsync();

  expect(instance.toggleStreaming).toHaveBeenCalledTimes(1);
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていて、アクションを求めている場合', async () => {
  setup({
    injectee: createInjectee({
      isNiconicoLoggedIn: true,
      updateStreamSettings: () => {
        return { url: '', name: '' };
      },
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  const channels = [
    {
      id: 'id',
      name: 'name',
      ownerName: 'ownerName',
      thumbnailUrl: 'thumbnailUrl',
      smallThumbnailUrl: 'smallThumbnailUrl',
    },
  ];

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() =>
    Promise.resolve({ ok: true, value: channels }),
  );

  instance.toggleStreaming = jest.fn();

  await instance.toggleStreamingAsync();

  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていて、番組がなかった場合', async () => {
  setup({
    injectee: createInjectee({
      isNiconicoLoggedIn: true,
      updateStreamSettings: () => {
        return { key: '' };
      },
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve(undefined));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  instance.toggleStreaming = jest.fn();
  instance.optimizeForNiconicoAndStartStreaming = jest.fn();

  jest.spyOn(remote.dialog, 'showMessageBox').mockImplementation(async function showMessageBox() {
    return { response: 0, checkboxChecked: false };
  });

  await instance.toggleStreamingAsync();

  expect(instance.toggleStreaming).not.toHaveBeenCalled();
  expect(instance.optimizeForNiconicoAndStartStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていて、番組が定まり(番組放送中)、最適化を行う場合', async () => {
  const updateStreamSettings = jest.fn(() => {
    return { key: 'hoge' };
  });
  setup({
    injectee: createInjectee({
      isNiconicoLoggedIn: true,
      updateStreamSettings,
      optimizeForNiconico: true,
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.optimizeForNiconicoAndStartStreaming = jest.fn();
  instance.toggleStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  await instance.toggleStreamingAsync();
  expect(updateStreamSettings).toBeCalledWith('lv12345');
  expect(instance.optimizeForNiconicoAndStartStreaming).toHaveBeenCalledTimes(1);
  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていて、番組が定まり(番組放送中+予約番組あり)、最適化を行う場合', async () => {
  const updateStreamSettings = jest.fn(() => {
    return { key: 'hoge' };
  });
  setup({
    injectee: createInjectee({
      isNiconicoLoggedIn: true,
      updateStreamSettings,
      optimizeForNiconico: true,
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.optimizeForNiconicoAndStartStreaming = jest.fn();
  instance.toggleStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() =>
    Promise.resolve({
      programId: 'lv12345',
      nextProgramId: 'lv67890',
    }),
  );
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  await instance.toggleStreamingAsync();
  expect(updateStreamSettings).toBeCalledWith('lv12345');
  expect(instance.optimizeForNiconicoAndStartStreaming).toHaveBeenCalledTimes(1);
  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていて、番組が定まり(予約番組のみ)、最適化を行う場合', async () => {
  const updateStreamSettings = jest.fn(() => {
    return { key: 'hoge' };
  });
  setup({
    injectee: createInjectee({
      isNiconicoLoggedIn: true,
      updateStreamSettings,
      optimizeForNiconico: true,
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.optimizeForNiconicoAndStartStreaming = jest.fn();
  instance.toggleStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() =>
    Promise.resolve({ nextProgramId: 'lv67890' }),
  );
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  await instance.toggleStreamingAsync();

  expect(updateStreamSettings).toBeCalledWith('lv67890');
  expect(instance.optimizeForNiconicoAndStartStreaming).toHaveBeenCalledTimes(1);
  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていて、番組が定まり、最適化を行わない場合', async () => {
  setup({
    injectee: createInjectee({
      isNiconicoLoggedIn: true,
      updateStreamSettings: () => {
        return { key: 'hoge' };
      },
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.toggleStreaming = jest.fn();
  instance.optimizeForNiconicoAndStartStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  await instance.toggleStreamingAsync();

  expect(instance.optimizeForNiconicoAndStartStreaming).not.toHaveBeenCalled();
  expect(instance.toggleStreaming).toHaveBeenCalledTimes(1);
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていて、番組取得にネットワークエラーで失敗した場合', async () => {
  setup({
    injectee: createInjectee({
      isNiconicoLoggedIn: true,
      updateStreamSettings: () => {
        throw new Error('NetworkError');
      },
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  jest.spyOn(remote.dialog, 'showMessageBox').mockImplementation(async function showMessageBox() {
    return { response: 0, checkboxChecked: false };
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.toggleStreaming = jest.fn();
  instance.optimizeForNiconicoAndStartStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  await instance.toggleStreamingAsync();

  expect(instance.optimizeForNiconicoAndStartStreaming).not.toHaveBeenCalled();
  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

test('toggleStreamingAsyncでstreamingStatusがoffline、ニコニコにログインしていて、番組取得にHTTPエラーで失敗した場合', async () => {
  setup({
    injectee: createInjectee({
      isNiconicoLoggedIn: true,
      updateStreamSettings: () => {
        throw new RequestError(500, 'updateStreamSettings dummy URL');
      },
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
      },
    },
  });

  jest.spyOn(remote.dialog, 'showMessageBox').mockImplementation(async function showMessageBox() {
    return { response: 0, checkboxChecked: false };
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.toggleStreaming = jest.fn();
  instance.optimizeForNiconicoAndStartStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  await instance.toggleStreamingAsync();

  expect(instance.optimizeForNiconicoAndStartStreaming).not.toHaveBeenCalled();
  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

const createInjecteeForOptimizeTest = ({
  showOptimizationDialogForNiconico = true,
  optimizeWithHardwareEncoder = false,
  diffDelta = { encoder: EncoderFamily.x264 } as OptimizedSettings['delta'],
  canvasResolutionWarning = undefined as OptimizedSettings['canvasResolutionWarning'],
} = {}) => {
  const injectee = createInjectee({
    isNiconicoLoggedIn: true,
    optimizeForNiconico: true,
    updateStreamSettings: () => ({
      key: 'hoge',
      quality: { bitrate: 6000, height: 720, fps: 30 },
    }),
  });
  return {
    ...injectee,
    CustomizationService: {
      ...injectee.CustomizationService,
      showOptimizationDialogForNiconico,
      optimizeWithHardwareEncoder,
    },
    SettingsService: {
      ...injectee.SettingsService,
      diffOptimizedSettings: jest.fn((): OptimizedSettings => ({
        best: {},
        current: {},
        delta: diffDelta,
        info: [],
        canvasResolutionWarning,
      })),
      optimizeForNiconico: jest.fn(),
    },
  };
};

test('optimizeForNiconicoAndStartStreaming: 差分あり・ダイアログ有効・非録画中はshowWindowを呼ぶ', async () => {
  const injectee = createInjecteeForOptimizeTest({ showOptimizationDialogForNiconico: true });
  setup({
    injectee,
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.toggleStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  showWindow.mockClear();
  await instance.toggleStreamingAsync();

  expect(showWindow).toHaveBeenCalledTimes(1);
  expect(injectee.SettingsService.optimizeForNiconico).not.toHaveBeenCalled();
  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

test('optimizeForNiconicoAndStartStreaming: 差分あり・ダイアログ無効・非録画中はoptimizeForNiconicoを即適用してtoggleStreamingを呼ぶ', async () => {
  const injectee = createInjecteeForOptimizeTest({ showOptimizationDialogForNiconico: false });
  setup({
    injectee,
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.toggleStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  showWindow.mockClear();
  await instance.toggleStreamingAsync();

  expect(showWindow).not.toHaveBeenCalled();
  expect(injectee.SettingsService.optimizeForNiconico).toHaveBeenCalledTimes(1);
  expect(instance.toggleStreaming).toHaveBeenCalledTimes(1);
});

test('optimizeForNiconicoAndStartStreaming: 差分あり・ダイアログ無効・録画中はshowWindowを呼び即適用しない', async () => {
  const injectee = createInjecteeForOptimizeTest({ showOptimizationDialogForNiconico: false });
  setup({
    injectee,
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Recording,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.toggleStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  showWindow.mockClear();
  await instance.toggleStreamingAsync();

  expect(showWindow).toHaveBeenCalledTimes(1);
  expect(injectee.SettingsService.optimizeForNiconico).not.toHaveBeenCalled();
  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

test('optimizeForNiconicoAndStartStreaming: 差分なし・録画中でもtoggleStreamingを呼ぶ', async () => {
  const injectee = createInjecteeForOptimizeTest({ diffDelta: {}, showOptimizationDialogForNiconico: false });
  setup({
    injectee,
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Recording,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.toggleStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  showWindow.mockClear();
  await instance.toggleStreamingAsync();

  expect(showWindow).not.toHaveBeenCalled();
  expect(injectee.SettingsService.optimizeForNiconico).not.toHaveBeenCalled();
  expect(instance.toggleStreaming).toHaveBeenCalledTimes(1);
});

test('optimizeForNiconicoAndStartStreaming: 差分なし・canvasResolutionWarningあり・ダイアログ無効でもshowWindowを呼ぶ', async () => {
  const injectee = createInjecteeForOptimizeTest({
    diffDelta: {},
    showOptimizationDialogForNiconico: false,
    canvasResolutionWarning: {
      canvas: '1280x720',
      recommendedResolution: '1920x1080',
      appliedResolution: '1280x720',
    },
  });
  setup({
    injectee,
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Offline,
        recordingStatus: ERecordingState.Offline,
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();
  instance.toggleStreaming = jest.fn();

  instance.client.fetchOnairUserProgram = jest.fn(() => Promise.resolve({ programId: 'lv12345' }));
  instance.client.fetchOnairChannels = jest.fn(() => Promise.resolve({ ok: true, value: [] }));

  showWindow.mockClear();
  await instance.toggleStreamingAsync();

  expect(showWindow).toHaveBeenCalledTimes(1);
  expect(injectee.SettingsService.optimizeForNiconico).not.toHaveBeenCalled();
  expect(instance.toggleStreaming).not.toHaveBeenCalled();
});

test('logStreamEndがstreamingTrackIdが設定されている場合にstream_endを送信する', () => {
  const recordEvent = jest.fn();
  setup({
    injectee: createInjectee({
      recordEvent,
      generateStreamingTrackID: () => 'test-track-id',
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Live,
        streamingTrackId: 'test-track-id',
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.logStreamEnd();

  expect(recordEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'stream_end',
      stream_track_id: 'test-track-id',
    }),
  );
});

test('logStreamEndがstreamingTrackIdが空の場合に何もしない', () => {
  const recordEvent = jest.fn();
  setup({
    injectee: createInjectee({ recordEvent }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Starting,
        streamingTrackId: '',
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.logStreamEnd();

  expect(recordEvent).not.toHaveBeenCalled();
});

test('logStreamEndが冪等である（2回呼んでもrecordEventは1回のみ）', () => {
  const recordEvent = jest.fn();
  setup({
    injectee: createInjectee({
      recordEvent,
      generateStreamingTrackID: () => 'test-track-id',
    }),
    state: {
      StreamingService: {
        streamingStatus: EStreamingState.Live,
        streamingTrackId: 'test-track-id',
      },
    },
  });

  const { StreamingService } = require('./streaming');
  const instance = StreamingService.instance();

  instance.logStreamEnd();
  instance.logStreamEnd();

  expect(recordEvent).toHaveBeenCalledTimes(1);
});
