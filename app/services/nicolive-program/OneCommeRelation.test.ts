import fetchMock from '@fetch-mock/jest';

jest.mock('services/nicolive-program/state', () => ({ NicoliveProgramStateService: {} }));
jest.mock('services/nicolive-program/nicolive-program', () => ({ NicoliveProgramService: {} }));
jest.mock('services/dev-hosts', () => ({ transformUrl: (url: string) => url }));

beforeEach(() => {
  jest.doMock('services/core/stateful-service');
  jest.doMock('services/core/injector');
  fetchMock.mockGlobal();
});

afterEach(() => {
  fetchMock.mockRestore({ includeSticky: true });
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('OneCommeRelation', () => {
  describe('sendService', () => {
    it('fetch失敗 (Failed to fetch) は console.warn のみで false を返す', async () => {
      fetchMock.any({ throws: new TypeError('Failed to fetch') });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { OneCommeRelation } = require('./OneCommeRelation');
      const relation = new OneCommeRelation();
      const result = await (relation as any).sendService({
        id: 'test-id',
        url: 'http://localhost:11180/watch/lv000',
        enabled: true,
        name: '#N_Air',
      });

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('[OneCommeRelation]');
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('その他のエラーは console.error を呼び false を返す', async () => {
      fetchMock.any({ throws: new Error('unexpected error') });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { OneCommeRelation } = require('./OneCommeRelation');
      const relation = new OneCommeRelation();
      const result = await (relation as any).sendService({
        id: 'test-id',
        url: 'http://localhost:11180/watch/lv000',
        enabled: true,
        name: '#N_Air',
      });

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
