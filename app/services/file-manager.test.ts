import path from 'path';

import { SentryReport } from 'util/sentry-report';

import { FileManagerService } from './file-manager';

interface IFileManagerInternals {
  files: Record<string, {
    data: string;
    locked: boolean;
    version: number;
    dirty: boolean;
  }>;
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
