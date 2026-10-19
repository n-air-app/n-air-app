import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';

jest.mock('components/nicolive-area/AreaSwitcher.vue', () => ({}));
jest.mock('components/nicolive-area/CommentFilter.vue', () => ({}));
jest.mock('components/nicolive-area/CommentViewer.vue', () => ({}));
jest.mock('components/nicolive-area/ProgramDescription.vue', () => ({}));
jest.mock('components/nicolive-area/ProgramInfo.vue', () => ({}));
jest.mock('components/nicolive-area/ProgramStatistics.vue', () => ({}));
jest.mock('components/nicolive-area/ToolBar.vue', () => ({}));
jest.mock('components/studio/PerformanceMetrics.vue', () => ({}));
jest.mock('../../../media/images/controls-arrow-vertical.svg', () => ({}));
jest.mock('services/customization', () => ({}));
jest.mock('services/nicolive-program/NicoliveFailure', () => ({
  NicoliveFailure: class {
    constructor(
      public type: string,
      public method: string,
      public reason: string,
    ) {}
  },
  openErrorDialogFromFailure: jest.fn().mockResolvedValue(undefined),
}));

const programService = {
  state: { status: 'onAir' },
  fetchProgram: jest.fn(),
  createProgram: jest.fn(),
  releaseProgram: jest.fn(),
};
jest.mock('services/nicolive-program/nicolive-program', () => ({
  NicoliveProgramService: { instance: () => programService },
}));

const NicoliveArea = require('./NicoliveArea.vue.ts').default;

function prepareProgram(context: { isFetching: boolean }): Promise<void> {
  return NicoliveArea.methods.prepareProgram.call(context);
}

function noSuitableProgram(): NicoliveFailure {
  return new NicoliveFailure('logic', 'fetchProgram', 'no_suitable_program');
}

describe('NicoliveArea.prepareProgram', () => {
  let context: { isFetching: boolean };

  beforeEach(() => {
    jest.clearAllMocks();
    context = { isFetching: false };
    programService.state.status = 'onAir';
    programService.fetchProgram.mockReset().mockResolvedValue(undefined);
    programService.createProgram.mockReset().mockResolvedValue(undefined);
    programService.releaseProgram.mockReset();
  });

  test('既存番組を取得できた場合は新規作成しない', async () => {
    await prepareProgram(context);

    expect(programService.fetchProgram).toHaveBeenCalledTimes(1);
    expect(programService.createProgram).not.toHaveBeenCalled();
    expect(programService.releaseProgram).not.toHaveBeenCalled();
    expect(openErrorDialogFromFailure).not.toHaveBeenCalled();
    expect(context.isFetching).toBe(false);
  });

  test('対象番組がない場合はエラーを表示せず新規作成する', async () => {
    programService.fetchProgram.mockRejectedValue(noSuitableProgram());

    await prepareProgram(context);

    expect(programService.createProgram).toHaveBeenCalledTimes(1);
    expect(programService.releaseProgram).not.toHaveBeenCalled();
    expect(openErrorDialogFromFailure).not.toHaveBeenCalled();
    expect(context.isFetching).toBe(false);
  });

  test('終了済み番組を取得した場合は番組情報を解放してから新規作成する', async () => {
    programService.state.status = 'end';
    programService.createProgram.mockImplementation(async () => {
      expect(programService.releaseProgram).toHaveBeenCalledTimes(1);
    });

    await prepareProgram(context);

    expect(programService.createProgram).toHaveBeenCalledTimes(1);
    expect(openErrorDialogFromFailure).not.toHaveBeenCalled();
    expect(context.isFetching).toBe(false);
  });

  test.each(['network_error', 'http_error', 'logic'] as const)(
    '番組取得が %s で失敗した場合はエラーを表示し新規作成しない',
    async (type) => {
      const failure = new NicoliveFailure(type, 'fetchProgram', 'failed');
      programService.fetchProgram.mockRejectedValue(failure);

      await prepareProgram(context);

      expect(openErrorDialogFromFailure).toHaveBeenCalledTimes(1);
      expect(openErrorDialogFromFailure).toHaveBeenCalledWith(failure);
      expect(programService.createProgram).not.toHaveBeenCalled();
      expect(context.isFetching).toBe(false);
    },
  );

  test.each(['network_error', 'http_error', 'logic'] as const)(
    '番組作成が %s で失敗した場合もエラーを表示する',
    async (type) => {
      const failure = new NicoliveFailure(type, 'createProgram', 'failed');
      programService.fetchProgram.mockRejectedValue(noSuitableProgram());
      programService.createProgram.mockRejectedValue(failure);

      await prepareProgram(context);

      expect(programService.createProgram).toHaveBeenCalledTimes(1);
      expect(openErrorDialogFromFailure).toHaveBeenCalledTimes(1);
      expect(openErrorDialogFromFailure).toHaveBeenCalledWith(failure);
      expect(context.isFetching).toBe(false);
    },
  );

  test.each(['fetchProgram', 'createProgram'] as const)(
    '%s の予期しないエラーはログに記録し処理中状態を解除する',
    async (method) => {
      const error = new Error('unexpected');
      if (method === 'createProgram') {
        programService.fetchProgram.mockRejectedValue(noSuitableProgram());
      }
      programService[method].mockRejectedValue(error);
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await prepareProgram(context);

        expect(consoleError).toHaveBeenCalledWith(error);
        expect(openErrorDialogFromFailure).not.toHaveBeenCalled();
        expect(context.isFetching).toBe(false);
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  test('処理中は重複実行を拒否し完了後に状態を解除する', async () => {
    let finishFetch!: () => void;
    programService.fetchProgram.mockImplementation(() => new Promise<void>((resolve) => {
      finishFetch = resolve;
    }));

    const pending = prepareProgram(context);
    expect(context.isFetching).toBe(true);
    await expect(prepareProgram(context)).rejects.toThrow('prepareProgram is running');
    expect(programService.fetchProgram).toHaveBeenCalledTimes(1);
    expect(context.isFetching).toBe(true);

    finishFetch();
    await pending;
    expect(context.isFetching).toBe(false);
  });
});
