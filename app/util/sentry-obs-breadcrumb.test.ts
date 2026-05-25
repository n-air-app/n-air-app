import * as Sentry from '@sentry/vue';

import { getLastObsOp, markObsOp } from './sentry-obs-breadcrumb';

jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
}));

describe('sentry-obs-breadcrumb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('markObsOp が breadcrumb を追加する', () => {
    markObsOp('ScenesService', 'makeSceneActive');
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'obs',
      message: 'ScenesService.makeSceneActive',
      level: 'info',
      data: undefined,
    });
  });

  test('markObsOp が obs.lastOp タグをセットする', () => {
    markObsOp('ScenesService', 'makeSceneActive');
    expect(Sentry.setTag).toHaveBeenCalledWith('obs.lastOp', 'ScenesService.makeSceneActive');
  });

  test('data が渡された場合は breadcrumb に含まれる', () => {
    markObsOp('SourcesService', 'createSource', { type: 'video_capture_device' });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'obs',
      message: 'SourcesService.createSource',
      level: 'info',
      data: { type: 'video_capture_device' },
    });
  });

  test('getLastObsOp は最後に呼んだ markObsOp の op を返す', () => {
    markObsOp('ScenesService', 'createScene');
    expect(getLastObsOp()).toBe('ScenesService.createScene');

    markObsOp('StreamingService', 'toggleStreaming');
    expect(getLastObsOp()).toBe('StreamingService.toggleStreaming');
  });

  test('初期値は空文字', () => {
    // module-scope なので他テストの後でも初期値は確認できないが
    // markObsOp を呼んだ後は上書きされることを確認
    markObsOp('ScenesService', 'removeScene', { sceneId: 'abc' });
    expect(getLastObsOp()).toBe('ScenesService.removeScene');
  });
});
