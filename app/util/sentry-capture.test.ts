import * as Sentry from '@sentry/vue';

import { captureServiceError, captureServiceMessage } from './sentry-capture';

jest.mock('@sentry/vue', () => ({
  withScope: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

describe('captureServiceError', () => {
  let mockScope: {
    setLevel: jest.Mock;
    setTag: jest.Mock;
    setExtra: jest.Mock;
    setFingerprint: jest.Mock;
    setContext: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockScope = {
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setFingerprint: jest.fn(),
      setContext: jest.fn(),
    };
    (Sentry.withScope as jest.Mock).mockImplementation((cb) => cb(mockScope));
  });

  test('captureException が呼ばれる', () => {
    const err = new Error('test');
    captureServiceError('FooService', 'barMethod', err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  test('service / method タグがセットされる', () => {
    captureServiceError('FooService', 'barMethod', new Error());
    expect(mockScope.setTag).toHaveBeenCalledWith('service', 'FooService');
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'barMethod');
  });

  test('デフォルト level は error', () => {
    captureServiceError('FooService', 'barMethod', new Error());
    expect(mockScope.setLevel).toHaveBeenCalledWith('error');
  });

  test('opts.level を上書きできる', () => {
    captureServiceError('FooService', 'barMethod', new Error(), { level: 'warning' });
    expect(mockScope.setLevel).toHaveBeenCalledWith('warning');
  });

  test('デフォルト fingerprint は [service, method, exception]', () => {
    captureServiceError('FooService', 'barMethod', new Error());
    expect(mockScope.setFingerprint).toHaveBeenCalledWith(['FooService', 'barMethod', 'exception']);
  });

  test('opts.fingerprint を上書きできる', () => {
    captureServiceError('FooService', 'barMethod', new Error(), {
      fingerprint: ['FooService', 'barMethod', 'obs', 'exception'],
    });
    expect(mockScope.setFingerprint).toHaveBeenCalledWith([
      'FooService',
      'barMethod',
      'obs',
      'exception',
    ]);
  });

  test('opts.extra が setExtra でセットされる', () => {
    captureServiceError('FooService', 'barMethod', new Error(), {
      extra: { foo: 'bar', count: 3 },
    });
    expect(mockScope.setExtra).toHaveBeenCalledWith('foo', 'bar');
    expect(mockScope.setExtra).toHaveBeenCalledWith('count', 3);
  });

  test('opts.tags が追加タグとしてセットされる', () => {
    captureServiceError('FooService', 'barMethod', new Error(), {
      tags: { collectionId: 'abc', collectionName: 'MyCollection' },
    });
    expect(mockScope.setTag).toHaveBeenCalledWith('collectionId', 'abc');
    expect(mockScope.setTag).toHaveBeenCalledWith('collectionName', 'MyCollection');
  });

  test('opts.context が setContext でセットされる', () => {
    const ctx = { id: 'abc', name: 'test' };
    captureServiceError('FooService', 'barMethod', new Error(), {
      context: { sceneCollection: ctx },
    });
    expect(mockScope.setContext).toHaveBeenCalledWith('sceneCollection', ctx);
  });

  test('opts.context に null を渡せる (クリア)', () => {
    captureServiceError('FooService', 'barMethod', new Error(), {
      context: { sceneCollection: null },
    });
    expect(mockScope.setContext).toHaveBeenCalledWith('sceneCollection', null);
  });
});

describe('captureServiceMessage', () => {
  let mockScope: {
    setLevel: jest.Mock;
    setTag: jest.Mock;
    setExtra: jest.Mock;
    setFingerprint: jest.Mock;
    setContext: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockScope = {
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setFingerprint: jest.fn(),
      setContext: jest.fn(),
    };
    (Sentry.withScope as jest.Mock).mockImplementation((cb) => cb(mockScope));
  });

  test('captureMessage が呼ばれる', () => {
    captureServiceMessage('FooService', 'barMethod', 'Something happened');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Something happened');
  });

  test('service / method タグがセットされる', () => {
    captureServiceMessage('FooService', 'barMethod', 'msg');
    expect(mockScope.setTag).toHaveBeenCalledWith('service', 'FooService');
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'barMethod');
  });

  test('デフォルト level は error', () => {
    captureServiceMessage('FooService', 'barMethod', 'msg');
    expect(mockScope.setLevel).toHaveBeenCalledWith('error');
  });

  test('opts.level を上書きできる', () => {
    captureServiceMessage('FooService', 'barMethod', 'msg', { level: 'warning' });
    expect(mockScope.setLevel).toHaveBeenCalledWith('warning');
  });

  test('opts.tags が追加タグとしてセットされる', () => {
    captureServiceMessage('FooService', 'barMethod', 'msg', {
      tags: { errorCount: '3' },
    });
    expect(mockScope.setTag).toHaveBeenCalledWith('errorCount', '3');
  });

  test('opts.context が setContext でセットされる', () => {
    const ctx = { items: 3 };
    captureServiceMessage('FooService', 'barMethod', 'msg', {
      context: { errors: ctx },
    });
    expect(mockScope.setContext).toHaveBeenCalledWith('errors', ctx);
  });
});
