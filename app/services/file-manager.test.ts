import path from 'path';

import * as remote from '@electron/remote';
import { SentryReport } from 'util/sentry-report';

import { FileManagerService } from './file-manager';

jest.mock('services/i18n', () => ({ $t: (key: string) => key }));

interface IFileManagerInternals {
  files: Record<string, {
    data: string;
    locked: boolean;
    version: number;
    dirty: boolean;
  }>;
  diskFullNotified: boolean;
  flush(filePath: string, tries?: number): Promise<void>;
  writeFile(filePath: string, data: string): Promise<void>;
}

test('get instance', () => {
  expect(FileManagerService.instance()).toBeInstanceOf(FileManagerService);
});

test('リトライ上限到達後も次回の保存を実行できる', async () => {
  const instance = FileManagerService.instance();
  const internals = instance as unknown as IFileManagerInternals;
  const filePath = path.resolve('file-manager-retry-test.json');
  internals.files[filePath] = {
    data: '{}',
    locked: false,
    version: 0,
    dirty: true,
  };

  const writeFile = jest.spyOn(internals, 'writeFile');
  writeFile.mockRejectedValueOnce(Object.assign(new Error('write failed'), { code: 'EPERM' }));
  jest.spyOn(SentryReport, 'message').mockImplementation();

  await internals.flush(filePath, 0);

  expect(internals.files[filePath]).toMatchObject({ locked: false, dirty: true });

  writeFile.mockResolvedValueOnce();
  await internals.flush(filePath);

  expect(writeFile).toHaveBeenCalledTimes(2);
  expect(internals.files[filePath]).toMatchObject({ locked: false, dirty: false });

  delete internals.files[filePath];
  jest.restoreAllMocks();
});

test('ENOSPCはリトライせず即座にダイアログを表示する', async () => {
  const instance = FileManagerService.instance();
  const internals = instance as unknown as IFileManagerInternals;
  internals.diskFullNotified = false;
  const filePath = path.resolve('file-manager-enospc-test.json');
  internals.files[filePath] = {
    data: '{}',
    locked: false,
    version: 0,
    dirty: true,
  };

  const writeFile = jest.spyOn(internals, 'writeFile');
  writeFile.mockRejectedValue(Object.assign(new Error('no space'), { code: 'ENOSPC' }));
  jest.spyOn(SentryReport, 'message').mockImplementation();
  const showMessageBox = jest.spyOn(remote.dialog, 'showMessageBox').mockClear().mockResolvedValue({ response: 0 } as any);

  await internals.flush(filePath);

  expect(writeFile).toHaveBeenCalledTimes(1);
  expect(internals.files[filePath]).toMatchObject({ locked: false, dirty: true });
  expect(showMessageBox).toHaveBeenCalledTimes(1);

  delete internals.files[filePath];
  jest.restoreAllMocks();
});

test('ENOSPCが繰り返し発生してもダイアログは1回だけ表示される', async () => {
  const instance = FileManagerService.instance();
  const internals = instance as unknown as IFileManagerInternals;
  internals.diskFullNotified = false;
  const filePath = path.resolve('file-manager-enospc-repeat-test.json');
  internals.files[filePath] = {
    data: '{}',
    locked: false,
    version: 0,
    dirty: true,
  };

  jest.spyOn(internals, 'writeFile').mockRejectedValue(
    Object.assign(new Error('no space'), { code: 'ENOSPC' }),
  );
  jest.spyOn(SentryReport, 'message').mockImplementation();
  const showMessageBox = jest.spyOn(remote.dialog, 'showMessageBox').mockClear().mockResolvedValue({ response: 0 } as any);

  await internals.flush(filePath);
  await internals.flush(filePath);
  await internals.flush(filePath);

  expect(showMessageBox).toHaveBeenCalledTimes(1);

  delete internals.files[filePath];
  jest.restoreAllMocks();
});
