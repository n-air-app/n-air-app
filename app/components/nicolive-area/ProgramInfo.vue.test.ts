/**
 * ProgramInfo.copyProgramURL / copyProgramPassword の unit test
 *
 * 番組情報の自動更新中 (isFetching中) でもコピーが実行できることを確認する (N-AIR-APP-GD5)。
 * 以前は isFetching 中は例外を投げてコピーを中断していたが、ユーザーからは
 * 「クリックしても反応しない」ように見えるだけで、例外はどこにも捕捉・表示されていなかった。
 */
import { clipboard } from 'electron';

jest.mock('electron', () => ({
  clipboard: { writeText: jest.fn() },
}));

jest.mock('components/shared/Popper.vue', () => ({}));
jest.mock('services/streaming', () => ({ StreamingService: { instance: () => ({}) } }));
jest.mock('services/user', () => ({ UserService: { instance: () => ({}) } }));

const getWatchPageURLMock = jest.fn((programID: string) => `https://live.nicovideo.jp/watch/${programID}`);
jest.mock('services/hosts', () => ({
  HostsService: { instance: () => ({ getWatchPageURL: getWatchPageURLMock }) },
}));

let nicoliveProgramState: { programID: string; password?: string; isFetching: boolean };
jest.mock('services/nicolive-program/nicolive-program', () => ({
  NicoliveProgramService: { instance: () => ({ state: nicoliveProgramState }) },
}));

const ProgramInfo = require('./ProgramInfo.vue.ts').default;

describe('ProgramInfo.copyProgramURL / copyProgramPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nicoliveProgramState = { programID: 'lv12345', password: 'pass1234', isFetching: false };
  });

  test('isFetching中でも copyProgramURL は現在のprogramIDをコピーする (N-AIR-APP-GD5)', () => {
    nicoliveProgramState.isFetching = true;

    expect(() => ProgramInfo.methods.copyProgramURL.call({})).not.toThrow();

    expect(clipboard.writeText).toHaveBeenCalledWith('https://live.nicovideo.jp/watch/lv12345');
  });

  test('isFetching中でも copyProgramPassword は現在のpasswordをコピーする (N-AIR-APP-GD5)', () => {
    nicoliveProgramState.isFetching = true;

    expect(() => ProgramInfo.methods.copyProgramPassword.call({})).not.toThrow();

    expect(clipboard.writeText).toHaveBeenCalledWith('pass1234');
  });

  test('passwordが未設定の場合は空文字をコピーする', () => {
    nicoliveProgramState.password = undefined;

    ProgramInfo.methods.copyProgramPassword.call({});

    expect(clipboard.writeText).toHaveBeenCalledWith('');
  });
});
