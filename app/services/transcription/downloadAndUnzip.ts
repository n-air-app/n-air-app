import { promises as fs } from 'node:fs';
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

import { pipeline } from 'stream/promises';
import unzip from 'unzip-stream';

export class DownloadError extends Error {
  constructor(
    public detail:
      | {
          reason: 'fetch';
          error: Error;
        }
      | {
          reason: 'response';
          response: Response;
        },
  ) {
    super(
      `Failed to download: ${
        detail.reason === 'fetch' ? detail.error.message : detail.response.statusText
      }`,
      detail.reason === 'fetch' ? { cause: detail.error } : undefined,
    );

    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ExtractError extends Error {
  constructor(public baseError: Error) {
    super(`Failed to extract: ${baseError.message}`, { cause: baseError });

    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CancelledError extends Error {
  constructor(cause?: unknown) {
    super('Download cancelled by user', cause !== undefined ? { cause } : undefined);

    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function downloadAndUnzip(
  url: string,
  zipPath: string,
  extractPath: string,
  onProgress: (status: { downloaded: number; total: number }) => void,
  signal?: AbortSignal,
) {
  // 1. Download the zip file
  await (async () => {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok || !response.body) {
        return Promise.reject(new DownloadError({ reason: 'response', response }));
      }
      const contentLength = response.headers.get('Content-Length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

      const fileStream = createWriteStream(zipPath);
      const reader = response.body.getReader();
      let progressTimer: NodeJS.Timeout | null = null;
      const progress: { downloaded: number; total: number } = { downloaded: 0, total: totalSize };

      const downloadStream = new Readable({
        async read() {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
            return;
          }
          progress.downloaded += value.length;
          if (progressTimer === null) {
            progressTimer = setInterval(() => {
              onProgress(progress);
            }, 1000);
          }
          this.push(value);
        },
      });

      // Setup abort listener
      const abortListener = () => {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
        reader.cancel();
      };

      if (signal) {
        signal.addEventListener('abort', abortListener);
      }

      try {
        await pipeline(downloadStream, fileStream);
        console.log('Download completed:', zipPath);
      } catch (error) {
        if (signal?.aborted) {
          throw new CancelledError(error);
        }
        throw error;
      } finally {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
        if (signal) {
          signal.removeEventListener('abort', abortListener);
        }
        onProgress(progress);
      }
    } catch (error) {
      // Re-throw CancelledError without wrapping
      if (error instanceof CancelledError) {
        throw error;
      }
      return Promise.reject(
        new DownloadError({
          reason: 'fetch',
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      );
    }
  })();

  // Check if download was cancelled before attempting to unzip
  if (signal?.aborted) {
    throw new CancelledError();
  }

  try {
    // 2. Unzip the downloaded file
    await fs.mkdir(extractPath, { recursive: true });
    console.log('Extracting to:', extractPath);

    const zipStream = createReadStream(zipPath);
    await pipeline(zipStream, unzip.Extract({ path: extractPath }));
  } catch (error) {
    throw new ExtractError(error instanceof Error ? error : new Error(String(error)));
  }

  console.log('Extraction completed.');
}
