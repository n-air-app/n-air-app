import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';

jest.mock('components/nicolive-area/CommentViewer.vue', () => ({}));
jest.mock('components/nicolive-area/ProgramInfo.vue', () => ({}));
jest.mock('components/nicolive-area/ProgramStatistics.vue', () => ({}));
jest.mock('components/nicolive-area/ToolBar.vue', () => ({}));
jest.mock('components/studio/PerformanceMetrics.vue', () => ({}));
jest.mock('services/customization', () => ({}));
jest.mock('services/i18n', () => ({ $t: (key: string) => key }));
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
  fetchScheduleSummary: jest.fn(),
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

  test('番組IDを指定した場合はそのIDで取得する', async () => {
    await NicoliveArea.methods.prepareProgram.call(context, 'lv123');

    expect(programService.fetchProgram).toHaveBeenCalledWith('lv123');
    expect(programService.createProgram).not.toHaveBeenCalled();
  });

  test('ID指定の番組が見つからない場合は新規作成せず概要を再取得する', async () => {
    programService.fetchProgram.mockRejectedValue(noSuitableProgram());
    const refreshSummary = jest.fn().mockResolvedValue(undefined);
    const ctx: any = { isFetching: false, refreshSummary };

    await NicoliveArea.methods.prepareProgram.call(ctx, 'lv123');

    expect(programService.createProgram).not.toHaveBeenCalled();
    expect(refreshSummary).toHaveBeenCalledTimes(1);
    expect(openErrorDialogFromFailure).not.toHaveBeenCalled();
    expect(ctx.isFetching).toBe(false);
  });

  test('ID指定の番組が終了済みだった場合は新規作成せず概要を再取得する', async () => {
    programService.state.status = 'end';
    const refreshSummary = jest.fn().mockResolvedValue(undefined);
    const ctx: any = { isFetching: false, refreshSummary };

    await NicoliveArea.methods.prepareProgram.call(ctx, 'lv123');

    expect(programService.releaseProgram).toHaveBeenCalledTimes(1);
    expect(programService.createProgram).not.toHaveBeenCalled();
    expect(refreshSummary).toHaveBeenCalledTimes(1);
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

describe('NicoliveArea.createNewProgram', () => {
  test('既存番組を取得せず新規作成する', async () => {
    const context = { isFetching: false };
    programService.fetchProgram.mockReset();
    programService.createProgram.mockReset().mockResolvedValue(undefined);

    await NicoliveArea.methods.createNewProgram.call(context);

    expect(programService.createProgram).toHaveBeenCalledTimes(1);
    expect(programService.fetchProgram).not.toHaveBeenCalled();
    expect(context.isFetching).toBe(false);
  });
});

describe('NicoliveArea.createNewProgram (放送中の番組がある場合)', () => {
  test('新規作成しない', async () => {
    const context = { isFetching: false, hasCurrentProgram: true };
    programService.createProgram.mockReset();

    await NicoliveArea.methods.createNewProgram.call(context);

    expect(programService.createProgram).not.toHaveBeenCalled();
  });
});

describe('NicoliveArea.createNewProgram (概要取得中)', () => {
  test('新規作成しない', async () => {
    const context = { isFetching: false, isLoadingSummary: true, hasCurrentProgram: false };
    programService.createProgram.mockReset();

    await NicoliveArea.methods.createNewProgram.call(context);

    expect(programService.createProgram).not.toHaveBeenCalled();
  });
});

describe('NicoliveArea.refreshSummary', () => {
  const summary = { current: null, reserved: null };

  test('概要を取得して保持する', async () => {
    programService.fetchScheduleSummary.mockReset().mockResolvedValue(summary);
    const context: any = { isLoadingSummary: false, isFetching: false, hasProgram: false };

    await NicoliveArea.methods.refreshSummary.call(context);

    expect(context.summary).toEqual(summary);
    expect(context.summaryError).toBe(false);
    expect(context.isLoadingSummary).toBe(false);
  });

  test('N Air で終了した番組は概要から除外する', async () => {
    const item = (id: string) => ({
      nicoliveProgramId: id,
      status: 'onAir',
      onAirBeginAt: 0,
      onAirEndAt: 0,
    });
    programService.fetchScheduleSummary
      .mockReset()
      .mockResolvedValue({ current: item('lv1'), reserved: item('lv2') });
    const context: any = {
      isLoadingSummary: false,
      isFetching: false,
      hasProgram: false,
      endedProgramId: 'lv1',
    };

    await NicoliveArea.methods.refreshSummary.call(context);

    expect(context.summary.current).toBeNull();
    expect(context.summary.reserved.nicoliveProgramId).toBe('lv2');
  });

  test('番組を保持している間は取得しない', async () => {
    programService.fetchScheduleSummary.mockReset();
    const context: any = { isLoadingSummary: false, isFetching: false, hasProgram: true };

    await NicoliveArea.methods.refreshSummary.call(context);

    expect(programService.fetchScheduleSummary).not.toHaveBeenCalled();
  });

  test('失敗してもダイアログは出さずエラー表示にする', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    programService.fetchScheduleSummary.mockReset().mockRejectedValue(new Error('x'));
    const context: any = { isLoadingSummary: false, isFetching: false, hasProgram: false };

    await NicoliveArea.methods.refreshSummary.call(context);

    expect(context.summaryError).toBe(true);
    expect(context.isLoadingSummary).toBe(false);
  });
});
