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
  jest.doMock('./NicoliveClient', () => ({
    NotLoggedInError: class {},
    isCertificateErrorCode: () => false,
  }));
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
  jest.doMock('./NicoliveClient', () => ({
    NotLoggedInError: class {},
    isCertificateErrorCode: () => false,
  }));
  const { showMessageBox, sentryMessage, NicoliveFailure, openErrorDialogFromFailure } = prepare('network_error');
  const failure = NicoliveFailure.fromClientError('method', {
    ok: false,
    value: new Error('network error'),
  });

  await openErrorDialogFromFailure(failure);
  expect(sentryMessage).not.toHaveBeenCalled();
  expect(showMessageBox).toHaveBeenCalled();
});

test('証明書エラーコードの場合は reason=certificate_error / errorCode を保持し network_error 扱いになる', async () => {
  jest.doMock('./NicoliveClient', () => ({
    NotLoggedInError: class {},
    isCertificateErrorCode: (code: string) => code === 'SELF_SIGNED_CERT_IN_CHAIN',
  }));
  const { NicoliveFailure } = prepare('network_error');
  const failure = NicoliveFailure.fromClientError('fetchIngestInfo', {
    ok: false,
    value: new Error('[MAIN_FETCH_FAIL code=SELF_SIGNED_CERT_IN_CHAIN] fetch failed'),
    diag: { route: 'main', failureKind: 'network_error', errorCode: 'SELF_SIGNED_CERT_IN_CHAIN' },
  });

  // Sentry で環境要因を区別できるよう errorCode が残る。type は network_error のまま(Sentry送信は抑制)
  expect(failure.type).toBe('network_error');
  expect(failure.reason).toBe('certificate_error');
  expect(failure.errorCode).toBe('SELF_SIGNED_CERT_IN_CHAIN');
});

test('certificate_error は method 個別文言が無くても network_error 文言にフォールバックし空ダイアログにならない', async () => {
  jest.doMock('./NicoliveClient', () => ({
    NotLoggedInError: class {},
    isCertificateErrorCode: (code: string) => code === 'SELF_SIGNED_CERT_IN_CHAIN',
  }));
  const { showMessageBox, NicoliveFailure, openErrorDialogFromFailure } = prepare('network_error');
  const failure = NicoliveFailure.fromClientError('fetchIngestInfo', {
    ok: false,
    value: new Error('[MAIN_FETCH_FAIL code=SELF_SIGNED_CERT_IN_CHAIN] fetch failed'),
    diag: { route: 'main', failureKind: 'network_error', errorCode: 'SELF_SIGNED_CERT_IN_CHAIN' },
  });

  await openErrorDialogFromFailure(failure);
  // fallbackChain の末尾 network_error に到達して文言が引けている(空でない)
  expect(showMessageBox.mock.calls[0][1].message).toBe('message');
});

test('http_error タイプの場合は Sentry に送信する', async () => {
  jest.doMock('./NicoliveClient', () => ({
    NotLoggedInError: class {},
    isCertificateErrorCode: () => false,
  }));
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

test('json_parse は type=network_error でも Sentry に送信される(fingerprint集約・diagnosticタグ付き)', async () => {
  jest.doMock('./NicoliveClient', () => ({
    NotLoggedInError: class {},
    isCertificateErrorCode: () => false,
  }));
  const { sentryMessage, NicoliveFailure, openErrorDialogFromFailure } = prepare('network_error');
  const { resetJsonParseReportState } = require('./NicoliveFailure');
  resetJsonParseReportState();

  const failure = NicoliveFailure.fromClientError('fetchProgramSchedules', {
    ok: false,
    value: new SyntaxError('Unexpected token'),
    diag: { route: 'renderer', failureKind: 'json_parse' },
  });
  expect(failure.type).toBe('network_error');
  expect(failure.failureKind).toBe('json_parse');

  await openErrorDialogFromFailure(failure);
  expect(sentryMessage).toHaveBeenCalledWith(
    'NicoliveProgram',
    'openErrorDialogFromFailure',
    expect.stringContaining('fetchProgramSchedules'),
    expect.objectContaining({
      level: 'warning',
      fingerprint: ['NicoliveProgram', 'json_parse', 'fetchProgramSchedules'],
      tags: expect.objectContaining({
        diagnostic: 'json-parse',
        'failure.method': 'fetchProgramSchedules',
        'failure.failureKind': 'json_parse',
      }),
    }),
  );
});

test('json_parse の連打は2段quotaガードで抑制される(セッション内1件・60秒窓)', async () => {
  jest.doMock('./NicoliveClient', () => ({
    NotLoggedInError: class {},
    isCertificateErrorCode: () => false,
  }));
  const { sentryMessage, NicoliveFailure, openErrorDialogFromFailure } = prepare('network_error');
  const { resetJsonParseReportState } = require('./NicoliveFailure');
  resetJsonParseReportState();

  const makeFailure = () =>
    NicoliveFailure.fromClientError('fetchProgramSchedules', {
      ok: false,
      value: new SyntaxError('Unexpected token'),
      diag: { route: 'renderer', failureKind: 'json_parse' },
    });

  await openErrorDialogFromFailure(makeFailure());
  await openErrorDialogFromFailure(makeFailure());
  await openErrorDialogFromFailure(makeFailure());

  // MAX_PER_KEY=1 のため、同一 method の2回目以降は60秒窓内は送信されない
  expect(sentryMessage).toHaveBeenCalledTimes(1);
});

test('json_parse でない network_error(certificate_error 等)は従来どおり送信されない', async () => {
  jest.doMock('./NicoliveClient', () => ({
    NotLoggedInError: class {},
    isCertificateErrorCode: (code: string) => code === 'SELF_SIGNED_CERT_IN_CHAIN',
  }));
  const { sentryMessage, NicoliveFailure, openErrorDialogFromFailure } = prepare('network_error');
  const { resetJsonParseReportState } = require('./NicoliveFailure');
  resetJsonParseReportState();

  const failure = NicoliveFailure.fromClientError('fetchIngestInfo', {
    ok: false,
    value: new Error('[MAIN_FETCH_FAIL code=SELF_SIGNED_CERT_IN_CHAIN] fetch failed'),
    diag: { route: 'main', failureKind: 'network_error', errorCode: 'SELF_SIGNED_CERT_IN_CHAIN' },
  });

  await openErrorDialogFromFailure(failure);
  expect(sentryMessage).not.toHaveBeenCalled();
});
