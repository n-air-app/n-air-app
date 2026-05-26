type NicoliveFailureType = typeof import('./NicoliveFailure').NicoliveFailure;

afterEach(() => {
  jest.resetModules();
});

function prepare(codeExists: string) {
  const showMessageBox = jest.fn().mockImplementation(async (_window, _option) => {});
  jest.doMock('@electron/remote', () => ({
    dialog: {
      showMessageBox,
    },
    getCurrentWindow: () => {},
  }));
  jest.doMock('services/i18n', () => ({
    $t: jest.fn().mockImplementation((key, { fallback } = {}) => {
      const keys = key.split('.');
      const code = keys[keys.length - 2];
      const value = keys[keys.length - 1];
      if (code === codeExists) return value;
      return fallback;
    }),
  }));

  const sentryMessage = jest.fn();
  jest.doMock('util/sentry-report', () => ({
    SentryReport: { message: sentryMessage },
  }));

  const m = require('./NicoliveFailure');
  const NicoliveFailure = m.NicoliveFailure as NicoliveFailureType;
  const openErrorDialogFromFailure = m.openErrorDialogFromFailure;

  return { showMessageBox, sentryMessage, NicoliveFailure, openErrorDialogFromFailure };
}

test('4xxで未定義文言だったら400にフォールバックする', async () => {
  jest.doMock('./NicoliveClient', () => ({ NotLoggedInError: class {} }));
  const { showMessageBox, NicoliveFailure, openErrorDialogFromFailure } = prepare('400');
  const failure = NicoliveFailure.fromClientError('method', {
    ok: false,
    value: { meta: { status: 403 } },
  });

  await openErrorDialogFromFailure(failure);
  expect(showMessageBox.mock.calls[0][1].title).toBe('title');
  expect(showMessageBox.mock.calls[0][1].message).toBe('message');
});

test('5xxで未定義文言だったら500にフォールバックする', async () => {
  const { showMessageBox, NicoliveFailure, openErrorDialogFromFailure } = prepare('500');
  const failure = NicoliveFailure.fromClientError('method', {
    ok: false,
    value: { meta: { status: 503 } },
  });

  await openErrorDialogFromFailure(failure);
  expect(showMessageBox.mock.calls[0][1].title).toBe('title');
  expect(showMessageBox.mock.calls[0][1].message).toBe('message');
});

test('errorCodeがあったらそれを使う', async () => {
  const { showMessageBox, NicoliveFailure, openErrorDialogFromFailure } = prepare('ERROR');
  const failure = NicoliveFailure.fromClientError('method', {
    ok: false,
    value: { meta: { status: 403, errorCode: 'ERROR' } },
  });

  await openErrorDialogFromFailure(failure);
  expect(showMessageBox.mock.calls[0][1].title).toBe('title');
  expect(showMessageBox.mock.calls[0][1].message).toBe('message');
});

test('errorCodeがなかったらstatusCodeを使う', async () => {
  const { showMessageBox, NicoliveFailure, openErrorDialogFromFailure } = prepare('403');
  const failure = NicoliveFailure.fromClientError('method', {
    ok: false,
    value: { meta: { status: 403, errorCode: 'ERROR' } },
  });

  await openErrorDialogFromFailure(failure);
  expect(showMessageBox.mock.calls[0][1].title).toBe('title');
  expect(showMessageBox.mock.calls[0][1].message).toBe('message');
});

test('errorCodeがなかったらstatusCode さらに x00 を使う', async () => {
  const { showMessageBox, NicoliveFailure, openErrorDialogFromFailure } = prepare('400');
  const failure = NicoliveFailure.fromClientError('method', {
    ok: false,
    value: { meta: { status: 403, errorCode: 'ERROR' } },
  });

  await openErrorDialogFromFailure(failure);
  expect(showMessageBox.mock.calls[0][1].title).toBe('title');
  expect(showMessageBox.mock.calls[0][1].message).toBe('message');
});

test('network_error タイプの場合は Sentry に送信しないが dialog は表示する', async () => {
  jest.doMock('./NicoliveClient', () => ({ NotLoggedInError: class {} }));
  const { showMessageBox, sentryMessage, NicoliveFailure, openErrorDialogFromFailure } = prepare('network_error');
  const failure = NicoliveFailure.fromClientError('method', {
    ok: false,
    value: new Error('network error'),
  });

  await openErrorDialogFromFailure(failure);
  expect(sentryMessage).not.toHaveBeenCalled();
  expect(showMessageBox).toHaveBeenCalled();
});

test('http_error タイプの場合は Sentry に送信する', async () => {
  jest.doMock('./NicoliveClient', () => ({ NotLoggedInError: class {} }));
  const { sentryMessage, NicoliveFailure, openErrorDialogFromFailure } = prepare('500');
  const failure = NicoliveFailure.fromClientError('method', {
    ok: false,
    value: { meta: { status: 500 } },
  });

  await openErrorDialogFromFailure(failure);
  expect(sentryMessage).toHaveBeenCalledWith(
    'NicoliveProgram',
    'openErrorDialogFromFailure',
    'openErrorDialogFromFailure',
    expect.objectContaining({ level: 'warning' }),
  );
});
