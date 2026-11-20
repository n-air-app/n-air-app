import { dialog } from '@electron/remote';

jest.mock('services/compact-mode', () => ({ CompactModeService: {} }));
jest.mock('services/i18n', () => ({ $t: (key: string) => key }));

const service = {
  state: { use: true },
  getStatus: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
};
jest.mock('services/substream/SubStreamService', () => ({
  SubStreamService: { instance: () => service },
}));

const component = require('./SubStreamButton.vue.ts').default;

function createContext() {
  const context = component.data();
  for (const [name, method] of Object.entries(component.methods)) {
    context[name] = (method as Function).bind(context);
  }
  return context;
}

function setStatus(status: string, busy = false, streaming = false) {
  service.getStatus.mockResolvedValue({ status, busy, streaming, displayStatus: status });
}

beforeEach(() => {
  jest.clearAllMocks();
  service.state.use = true;
  service.start.mockReset();
  service.stop.mockReset();
  setStatus('stopped');
});

test.each(['stopped', 'deactive'])('%s のとき開始可能になる', async (status) => {
  setStatus(status);
  const context = createContext();
  await context.updateSubStreamStatus();
  expect(context.canStartSubStream).toBe(true);
  expect(context.subStreamStatus).toBe(status);
});

test.each(['starting', 'started', 'stopping', 'reconnect', 'reconnected', 'unknown'])(
  '%s のとき開始ボタンを表示しない',
  async (status) => {
    setStatus(status);
    const context = createContext();
    await context.updateSubStreamStatus();
    expect(context.canStartSubStream).toBe(false);
    expect(context.subStreamStatus).toBe(status);
  },
);

test.each([[true, false], [false, true]])('処理中・配信中は開始不可 (%s, %s)', async (busy, streaming) => {
  setStatus('stopped', busy, streaming);
  const context = createContext();
  await context.updateSubStreamStatus();
  expect(context.canStartSubStream).toBe(false);
});

test('サブ配信が無効なら状態をクリアする', async () => {
  service.state.use = false;
  const context = createContext();
  context.canStartSubStream = true;
  context.canStopSubStream = true;
  context.subStreamStatus = 'stopped';
  await context.updateSubStreamStatus();
  expect(context.canStartSubStream).toBe(false);
  expect(context.subStreamStatus).toBe('');
  expect(context.canStopSubStream).toBe(false);
  expect(service.getStatus).not.toHaveBeenCalled();
});

test('開始処理を実行して状態を更新し、連打は無視する', async () => {
  const context = createContext();
  await context.updateSubStreamStatus();
  service.start.mockImplementation(async () => {
    expect(context.subStreamStarting).toBe(true);
    await context.startSubStream();
    setStatus('started', false, true);
  });
  await context.startSubStream();
  expect(service.start).toHaveBeenCalledTimes(1);
  expect(context.subStreamStatus).toBe('started');
  expect(context.canStartSubStream).toBe(false);
  expect(context.subStreamStarting).toBe(false);
});

test('クリック後に状態が変わった場合は開始しない', async () => {
  const context = createContext();
  await context.updateSubStreamStatus();
  setStatus('starting', true);
  await context.startSubStream();
  expect(service.start).not.toHaveBeenCalled();
  expect(context.subStreamStarting).toBe(false);
});

test('設定不備はダイアログに表示する', async () => {
  const context = createContext();
  await context.updateSubStreamStatus();
  service.start.mockResolvedValue('URLとストリームキーを設定してください');
  await context.startSubStream();
  expect(dialog.showErrorBox).toHaveBeenCalledWith(
    'settings.substream.info.error', 'URLとストリームキーを設定してください',
  );
  expect(context.subStreamStarting).toBe(false);
});

test('開始処理の例外を表示してボタンの処理中状態を解除する', async () => {
  const context = createContext();
  await context.updateSubStreamStatus();
  service.start.mockRejectedValue(new Error('disconnected'));
  await context.startSubStream();
  expect(dialog.showErrorBox).toHaveBeenCalledWith(
    'settings.substream.info.error', 'settings.substream.error.connect_failed',
  );
  expect(context.subStreamStarting).toBe(false);
});

test.each(['started', 'reconnect', 'reconnected'])('%s で送出中なら停止可能になる', async (status) => {
  setStatus(status, false, true);
  const context = createContext();
  await context.updateSubStreamStatus();
  expect(context.canStopSubStream).toBe(true);
  expect(context.canStartSubStream).toBe(false);
});

test.each([[true, true], [false, false]])('処理中・停止中は停止不可 (%s, %s)', async (busy, streaming) => {
  setStatus('stopping', busy, streaming);
  const context = createContext();
  await context.updateSubStreamStatus();
  expect(context.canStopSubStream).toBe(false);
});

test('停止処理を実行して状態を更新し、連打や開始は無視する', async () => {
  setStatus('started', false, true);
  const context = createContext();
  await context.updateSubStreamStatus();
  service.stop.mockImplementation(async () => {
    expect(context.subStreamStopping).toBe(true);
    await context.stopSubStream();
    context.canStartSubStream = true;
    await context.startSubStream();
    setStatus('stopped');
  });
  await context.stopSubStream();
  expect(service.stop).toHaveBeenCalledTimes(1);
  expect(service.start).not.toHaveBeenCalled();
  expect(context.subStreamStatus).toBe('stopped');
  expect(context.canStartSubStream).toBe(true);
  expect(context.canStopSubStream).toBe(false);
  expect(context.subStreamStopping).toBe(false);
});

test('クリック後に停止済みになっていた場合は停止しない', async () => {
  setStatus('started', false, true);
  const context = createContext();
  await context.updateSubStreamStatus();
  setStatus('stopped');
  await context.stopSubStream();
  expect(service.stop).not.toHaveBeenCalled();
  expect(context.subStreamStopping).toBe(false);
});

test('開始処理中は停止操作を無視する', async () => {
  const context = createContext();
  context.canStopSubStream = true;
  context.subStreamStarting = true;
  await context.stopSubStream();
  expect(service.stop).not.toHaveBeenCalled();
});

test('停止処理の例外を表示して処理中状態を解除する', async () => {
  setStatus('started', false, true);
  const context = createContext();
  await context.updateSubStreamStatus();
  service.stop.mockRejectedValue(new Error('disconnected'));
  await context.stopSubStream();
  expect(dialog.showErrorBox).toHaveBeenCalledWith(
    'settings.substream.info.error', 'settings.substream.error.connect_failed',
  );
  expect(context.subStreamStopping).toBe(false);
});

test('ロック中は開始・停止とも実行しない', async () => {
  const context = createContext();
  context.locked = true;
  context.canStartSubStream = true;
  context.canStopSubStream = true;
  await context.startSubStream();
  await context.stopSubStream();
  expect(service.start).not.toHaveBeenCalled();
  expect(service.stop).not.toHaveBeenCalled();
});

test.each([
  [false, false, false, false],
  [false, false, true, true],
  [true, false, true, false],
  [false, true, false, true],
])('開始・停止のボタン表示を状態に合わせる (%s, %s, %s)', (starting, stopping, streaming, expected) => {
  const context = createContext();
  context.subStreamStarting = starting;
  context.subStreamStopping = stopping;
  context.subStreamStreaming = streaming;
  expect(component.computed.isStopButton.call(context)).toBe(expected);
});

test.each([
  [false, false, false, true, false],
  [true, false, false, true, true],
  [false, true, false, true, true],
  [false, false, true, true, true],
  [false, false, false, false, true],
])('操作可否を状態に合わせる (%s, %s, %s, %s)', (locked, starting, stopping, canOperate, expected) => {
  const context = createContext();
  context.locked = locked;
  context.subStreamStarting = starting;
  context.subStreamStopping = stopping;
  context.isStopButton = false;
  context.canStartSubStream = canOperate;
  expect(component.computed.isDisabled.call(context)).toBe(expected);
  context.isStopButton = true;
  context.canStopSubStream = canOperate;
  expect(component.computed.isDisabled.call(context)).toBe(expected);
});
