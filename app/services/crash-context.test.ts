import { Subject } from 'rxjs';
import { createSetupFunction } from 'util/test-setup';

const mockSetObsOpObserver = jest.fn();
jest.mock('util/sentry-obs-breadcrumb', () => ({
  setObsOpObserver: mockSetObsOpObserver,
}));

const mockAddExtraParameter = jest.fn();
const mockIpcSend = jest.fn();

jest.mock('@electron/remote', () => ({
  crashReporter: {
    addExtraParameter: mockAddExtraParameter,
  },
}));

jest.mock('electron', () => ({
  ipcRenderer: {
    send: mockIpcSend,
  },
}));

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/core/service-initialization-observer', () => ({
  InitAfter: () => () => {},
}));

function makeScenesMock() {
  const sceneSwitched = new Subject<any>();
  const sceneAdded = new Subject<any>();
  const sceneRemoved = new Subject<any>();
  return {
    sceneSwitched,
    sceneAdded,
    sceneRemoved,
    scenes: [{ id: 's1' }, { id: 's2' }],
    activeScene: {
      name: 'Scene 1',
      getItems: () => [
        { sourceId: 'src1' },
        { sourceId: 'src2' },
        { sourceId: 'src3' },
        { sourceId: 'src4' },
      ],
    },
  };
}

function makeSourcesMock() {
  const sourceAdded = new Subject<any>();
  const sourceRemoved = new Subject<any>();
  return {
    sourceAdded,
    sourceRemoved,
    getSource: (id: string) => ({ name: `source-${id}` }),
  };
}

function makeStreamingMock() {
  const streamingStatusChange = new Subject<any>();
  return {
    streamingStatusChange,
    state: { streamingStatus: 'offline' },
  };
}

function makeSettingsMock() {
  return {
    getStreamEncoderSettings: jest.fn().mockReturnValue({
      encoder: 'obs_x264',
      outputResolution: '1920x1080',
      fps: '60',
      bitrate: 6000,
      audio: { bitrate: '192' },
    }),
  };
}

const scenesMock = makeScenesMock();
const sourcesMock = makeSourcesMock();
const streamingMock = makeStreamingMock();
const settingsMock = makeSettingsMock();

const setup = createSetupFunction({
  injectee: {
    ScenesService: scenesMock,
    SourcesService: sourcesMock,
    StreamingService: streamingMock,
    SettingsService: settingsMock,
  },
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

test('init() でシーン名・シーン数・ソースリスト・エンコーダー・ストリーミング状態が設定される', () => {
  setup();
  const { CrashContextService } = require('./crash-context');
  const instance = CrashContextService.instance();
  instance.init();

  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.scene', 'Scene 1');
  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.scenes.count', '2');
  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.streaming', 'offline');
  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.encoder.video', 'obs_x264 1920x1080 60fps 6000kbps');
  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.encoder.audio', 'aac 192kbps');
});

test('init() でcrash-context-updateがipcRenderer経由でmainに送信される', () => {
  setup();
  const { CrashContextService } = require('./crash-context');
  const instance = CrashContextService.instance();
  instance.init();

  expect(mockIpcSend).toHaveBeenCalledWith('crash-context-update', 'nair.scene', 'Scene 1');
});

test('init() でソースが4件の場合、先頭3件+件数が記録される', () => {
  setup();
  const { CrashContextService } = require('./crash-context');
  const instance = CrashContextService.instance();
  instance.init();

  expect(mockAddExtraParameter).toHaveBeenCalledWith(
    'nair.sources',
    'source-src1,source-src2,source-src3,...(4)',
  );
});

test('setLastUserOp() でnair.lastUserOpが設定される', () => {
  setup();
  const { CrashContextService } = require('./crash-context');
  const instance = CrashContextService.instance();
  instance.init();
  jest.clearAllMocks();

  instance.setLastUserOp('menu:file.openSceneCollection');

  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.lastUserOp', 'menu:file.openSceneCollection');
  expect(mockIpcSend).toHaveBeenCalledWith('crash-context-update', 'nair.lastUserOp', 'menu:file.openSceneCollection');
});

test('setLastObsOp() でnair.lastObsOpが設定される', () => {
  setup();
  const { CrashContextService } = require('./crash-context');
  const instance = CrashContextService.instance();
  instance.init();
  jest.clearAllMocks();

  instance.setLastObsOp('ScenesService.makeSceneActive');

  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.lastObsOp', 'ScenesService.makeSceneActive');
});

test('setAppPhase() でnair.appPhaseが設定される', () => {
  setup();
  const { CrashContextService } = require('./crash-context');
  const instance = CrashContextService.instance();
  instance.init();
  jest.clearAllMocks();

  instance.setAppPhase('streaming');

  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.appPhase', 'streaming');
});

test('init() で markObsOp の observer が登録され、nair.lastObsOp が自動設定される', () => {
  let capturedObserver: ((op: string) => void) | null = null;
  mockSetObsOpObserver.mockImplementation((fn: (op: string) => void) => {
    capturedObserver = fn;
  });

  setup();
  const { CrashContextService } = require('./crash-context');
  CrashContextService.instance().init();
  jest.clearAllMocks();

  expect(capturedObserver).not.toBeNull();
  capturedObserver!('StreamingService.startStreaming');

  expect(mockAddExtraParameter).toHaveBeenCalledWith('nair.lastObsOp', 'StreamingService.startStreaming');
});
