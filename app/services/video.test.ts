import * as FakeTimers from '@sinonjs/fake-timers';

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/settings', () => ({}));
jest.mock('./settings-v2', () => ({}));
jest.mock('services/windows', () => ({}));
jest.mock('services/selection', () => ({}));
jest.mock('./utils', () => ({
  __esModule: true,
  default: { getCurrentUrlParams: () => ({ windowId: 'main' }) },
}));
jest.mock('@electron/remote', () => ({
  getCurrentWindow: () => mockElectronWindow,
  BrowserWindow: { fromId: () => mockElectronWindow },
}));
jest.mock('../../obs-api', () => ({
  NodeObs: {
    OBS_content_createDisplay: jest.fn(),
    OBS_content_createSourcePreviewDisplay: jest.fn(),
    OBS_content_moveDisplay: jest.fn(),
    OBS_content_resizeDisplay: jest.fn(),
    OBS_content_destroyDisplay: jest.fn(),
    OBS_content_getDisplayPreviewOffset: jest.fn(() => ({ x: 0, y: 0 })),
    OBS_content_getDisplayPreviewSize: jest.fn(() => ({ width: 100, height: 100 })),
    OBS_content_setPaddingColor: jest.fn(),
    OBS_content_setPaddingSize: jest.fn(),
    OBS_content_setShouldDrawUI: jest.fn(),
    OBS_content_setDrawGuideLines: jest.fn(),
  },
  ERenderingMode: { OBS_MAIN_RENDERING: 0 },
}));

const mockElectronWindow = {
  id: 1,
  on: jest.fn(),
  removeListener: jest.fn(),
  getNativeWindowHandle: jest.fn((): Buffer => Buffer.alloc(0)),
};

const mockElement = {
  getBoundingClientRect: () => ({ left: 10, top: 10, width: 200, height: 150 }),
} as unknown as HTMLElement;

function makeVideoServiceMock() {
  return {
    createOBSDisplay: jest.fn(),
    setOBSDisplayPaddingColor: jest.fn(),
    setOBSDisplayShouldDrawUI: jest.fn(),
    setOBSDisplayDrawGuideLines: jest.fn(),
    moveOBSDisplay: jest.fn(),
    resizeOBSDisplay: jest.fn(),
    destroyOBSDisplay: jest.fn(),
    getOBSDisplayPreviewOffset: jest.fn(() => ({ x: 5, y: 5 })),
    getOBSDisplayPreviewSize: jest.fn(() => ({ width: 100, height: 100 })),
  };
}

function setupInjectee(videoService: ReturnType<typeof makeVideoServiceMock>) {
  const { __setup } = require('services/core/injector');
  __setup({
    SettingsService: { loadSettingsIntoStore: jest.fn() },
    VideoSettingsService: {},
    VideoService: videoService,
    WindowsService: { state: { main: { scaleFactor: 1 } } },
    SelectionService: { updated: { subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })) } },
  });
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Display ライフサイクルガード', () => {
  test('destroy後にタイマーが発火してもmoveOBSDisplayが呼ばれない', () => {
    const mockVideoService = makeVideoServiceMock();
    setupInjectee(mockVideoService);
    const { Display } = require('./video');

    const clock = FakeTimers.install();
    try {
      const display = new Display('test-uuid-1');
      display.trackElement(mockElement);

      // destroy を先に呼んで displayDestroyed = true にする
      display.remoteClose();

      // タイマーを進めてもコールバックは早期リターンする
      clock.tick(60);
    } finally {
      clock.uninstall();
    }

    expect(mockVideoService.moveOBSDisplay).not.toHaveBeenCalled();
  });

  test('displayDestroyedフラグが立っていればtrackingFunでmoveが呼ばれない', () => {
    const mockVideoService = makeVideoServiceMock();
    setupInjectee(mockVideoService);
    const { Display } = require('./video');

    const clock = FakeTimers.install();
    try {
      const display = new Display('test-uuid-2');
      display.trackElement(mockElement);

      // タイマーをクリアせず displayDestroyed だけ設定してレースをシミュレート
      display.displayDestroyed = true;

      clock.tick(60);
    } finally {
      clock.uninstall();
    }

    expect(mockVideoService.moveOBSDisplay).not.toHaveBeenCalled();
  });

  test('destroy前はタイマーでmoveOBSDisplayが正常に呼ばれる（正常系確認）', () => {
    const mockVideoService = makeVideoServiceMock();
    setupInjectee(mockVideoService);
    const { Display } = require('./video');

    const clock = FakeTimers.install();
    try {
      const display = new Display('test-uuid-3');
      display.trackElement(mockElement);

      clock.tick(60);
    } finally {
      clock.uninstall();
    }

    expect(mockVideoService.moveOBSDisplay).toHaveBeenCalled();
  });

  test('destroy後にrefreshOutputRegionを呼んでもgetOBSDisplayPreviewOffsetが呼ばれない', async () => {
    const mockVideoService = makeVideoServiceMock();
    setupInjectee(mockVideoService);
    const { Display } = require('./video');

    const display = new Display('test-uuid-4');
    display.displayDestroyed = true;

    await display.refreshOutputRegion();

    expect(mockVideoService.getOBSDisplayPreviewOffset).not.toHaveBeenCalled();
  });
});

describe('VideoService OBSラッパー エラー格下げ', () => {
  function setupVideoService() {
    const { __setup } = require('services/core/injector');
    __setup({
      SettingsService: { loadSettingsIntoStore: jest.fn() },
      VideoSettingsService: {},
    });
    const { VideoService } = require('./video');
    return VideoService.instance;
  }

  test('moveOBSDisplayが"Invalid key"エラーを投げてもwarnとして格下げされ伝播しない', () => {
    const obsApi = require('../../obs-api');
    const instance = setupVideoService();

    obsApi.NodeObs.OBS_content_moveDisplay.mockImplementation(() => {
      throw new Error('Invalid key provided to moveDisplay: some-uuid');
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => instance.moveOBSDisplay('some-uuid', 0, 0)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      '[VideoService] moveOBSDisplay:',
      expect.stringContaining('Invalid key provided to moveDisplay'),
    );
    warnSpy.mockRestore();
  });

  test('destroyOBSDisplayが"Failed to find key"エラーを投げてもwarnとして格下げされ伝播しない', () => {
    const obsApi = require('../../obs-api');
    const instance = setupVideoService();

    obsApi.NodeObs.OBS_content_destroyDisplay.mockImplementation(() => {
      throw new Error('Failed to find key for destruction: some-uuid');
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => instance.destroyOBSDisplay('some-uuid')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      '[VideoService] destroyOBSDisplay:',
      expect.stringContaining('Failed to find key for destruction'),
    );
    warnSpy.mockRestore();
  });

  test('既知でないエラーはmoveOBSDisplayから再スローされる', () => {
    const obsApi = require('../../obs-api');
    const instance = setupVideoService();

    obsApi.NodeObs.OBS_content_moveDisplay.mockImplementation(() => {
      throw new Error('OOM: out of memory');
    });

    expect(() => instance.moveOBSDisplay('some-uuid', 0, 0)).toThrow('OOM: out of memory');
  });
});
