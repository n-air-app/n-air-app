import fs from 'fs';
import path from 'path';

import { createSetupFunction } from 'util/test-setup';

const mockShowMessageBox = jest.fn();
const mockGetCurrentWindow = jest.fn().mockReturnValue({ id: 'current' });
jest.mock('@electron/remote', () => ({
  dialog: { showMessageBox: mockShowMessageBox },
  getCurrentWindow: mockGetCurrentWindow,
}));
jest.mock('services/i18n', () => ({ $t: (key: string) => key }));
jest.mock('util/sentry-obs-breadcrumb', () => ({
  getLastObsOp: () => 'SourcesService.removeSource',
}));
const mockSentryMessage = jest.fn();
jest.mock('util/sentry-report', () => ({ SentryReport: { message: mockSentryMessage } }));

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/app', () => ({ AppService: class {} }));
jest.mock('services/windows', () => ({ WindowsService: class {} }));

describe('ObsIpcHealthService', () => {
  let mockRelaunch: jest.Mock;
  let mockGetDialogParent: jest.Mock;

  const setup = createSetupFunction({
    injectee: {},
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockRelaunch = jest.fn();
    // 親ウィンドウ解決ロジック自体は util/dialog-parent.test.ts で検証するため、
    // ここでは既定で main を返すだけの単純なモックにする。
    mockGetDialogParent = jest.fn().mockReturnValue({ window: { id: 'main' }, kind: 'main' });

    setup({
      injectee: {
        AppService: { relaunch: mockRelaunch },
        WindowsService: {
          getDialogParent: mockGetDialogParent,
        },
      },
    });
  });

  test('notifyIpcLost() で isLost が true になる', () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();

    instance.notifyIpcLost('test');

    expect(instance.isLost).toBe(true);
  });

  test('3回呼んでもダイアログは1回だけ表示される', () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();

    instance.notifyIpcLost('first');
    instance.notifyIpcLost('second');
    instance.notifyIpcLost('third');

    expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
  });

  test('ipcLost Subject が1回だけ発火し、検知元が渡る', () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();
    const observer = jest.fn();
    instance.ipcLost.subscribe(observer);

    instance.notifyIpcLost('PerformanceService.getState');
    instance.notifyIpcLost('SettingsService.getSettingsFormData');

    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith('PerformanceService.getState');
  });

  test('ダイアログで「はい」を選ぶと relaunch が呼ばれる', async () => {
    mockShowMessageBox.mockResolvedValue({ response: 0 });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();

    instance.notifyIpcLost('test');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  test('ダイアログで「いいえ」を選ぶと relaunch は呼ばれない', async () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();

    instance.notifyIpcLost('test');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockRelaunch).not.toHaveBeenCalled();
  });

  test('「いいえ」を選んだ後に再度 notifyIpcLost してもダイアログが表示されない', async () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();

    instance.notifyIpcLost('test');
    await Promise.resolve();
    await Promise.resolve();
    instance.notifyIpcLost('test again');

    expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
  });

  test('windowsService.getDialogParent() が返した window をモーダル親にする', () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    const childWindow = { id: 'child' };
    mockGetDialogParent.mockReturnValue({ window: childWindow, kind: 'child' });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();

    instance.notifyIpcLost('test');

    expect(mockShowMessageBox).toHaveBeenCalledWith(childWindow, expect.anything());
  });

  test('親ウィンドウが取得できない場合は親を渡さずダイアログを表示する', () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    mockGetDialogParent.mockReturnValue({ window: null, kind: 'none' });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();

    instance.notifyIpcLost('test');

    expect(mockShowMessageBox).toHaveBeenCalledWith(expect.anything());
    expect(mockShowMessageBox.mock.calls[0]).toHaveLength(1);
  });

  test('Sentry へ diagnostic タグ付き・warning で1回だけ報告する', () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    const { ObsIpcHealthService } = require('./obs-ipc-health');
    const instance = ObsIpcHealthService.instance();

    instance.notifyIpcLost('PerformanceService.getState');
    instance.notifyIpcLost('SettingsService.getSettingsFormData');

    expect(mockSentryMessage).toHaveBeenCalledTimes(1);
    expect(mockSentryMessage).toHaveBeenCalledWith(
      'ObsIpcHealthService',
      'notifyIpcLost',
      'obs backend ipc lost',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({ diagnostic: 'obs-ipc-lost' }),
        fingerprint: ['ObsIpcHealthService', 'obsBackendIpcLost'],
      }),
    );
  });

  test('ObsIpcHealthService が app-services.ts に登録されている', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../app-services.ts'), 'utf8');
    expect(src).toMatch(/export \{ ObsIpcHealthService \} from 'services\/obs-ipc-health';/);
  });
});
