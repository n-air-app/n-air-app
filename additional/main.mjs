// additional.jsonに記載された追加ファイルをダウンロード・展開・コピーするスクリプト
// 主にobs-studio-nodeのネイティブライブラリを配置するために使用
//
// cacheを消すには .cache ディレクトリを削除するか、
// スクリプトを clean オプション付きで実行します。
// 例: node additional/main.mjs clean

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import unzip from 'unzip-stream'; // この時点で各種modulesはインストールされている前提

import additionalFiles from './additional.json' with { type: 'json' };

// 出力ディレクトリのパス
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const destPath = path.resolve(__dirname, '../');
const cacheDir = path.resolve(__dirname, '.cache/');

// 指定したURLからファイルをダウンロードする
async function download(url) {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const extension = path.extname(new URL(url).pathname) || '';
  const cacheFileName = `${hash}${extension}`;
  const cachePath = path.join(cacheDir, cacheFileName);

  // キャッシュファイルが存在する場合はそのパスを返す
  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  try {
    console.log(`downloading: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const bufferData = Buffer.from(buffer);

    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, bufferData);

    return cachePath;
  } catch (error) {
    throw new Error(`Failed to download: ${error.message}`, { cause: error });
  }
}

// アーカイブを展開
async function extract(sourcePath, destinationPath, url) {
  const cacheDirName = crypto.createHash('md5').update(url).digest('hex');
  const extractCachePath = path.join(cacheDir, 'extracted', cacheDirName);

  // 展開キャッシュが存在する場合はそれを使用
  if (fs.existsSync(extractCachePath)) {
    copyDirectory(extractCachePath, destinationPath);
    return;
  }

  return new Promise((resolve, reject) => {
    // 展開キャッシュディレクトリを作成
    fs.mkdirSync(extractCachePath, { recursive: true });

    fs.createReadStream(sourcePath)
      .pipe(unzip.Extract({ path: extractCachePath }))
      .on('close', () => {
        copyDirectory(extractCachePath, destinationPath);
        resolve();
      })
      .on('error', reject);
  });
}

// スキップ機能付きファイルコピー
function copyFileWithSkip(sourcePath, destPath) {
  // ファイルが同じかどうかをチェック
  if (fs.existsSync(destPath)) {
    const sourceStats = fs.statSync(sourcePath);
    const destStats = fs.statSync(destPath);
    if (sourceStats.size === destStats.size &&
        sourceStats.mtime.getTime() <= destStats.mtime.getTime()) {
      return false;
    }
  }

  fs.copyFileSync(sourcePath, destPath);
  return true;
}

// ディレクトリを再帰的にコピーする
function copyDirectory(sourceDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const files = fs.readdirSync(sourceDir);

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);

    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectory(sourcePath, destPath);
    } else {
      copyFileWithSkip(sourcePath, destPath);
    }
  }
}

async function main() {
  if ((process.argv.includes('clean') || process.argv.includes('--clean')) && fs.existsSync(cacheDir)) {
    console.log(`remove cache dir: ${cacheDir}`);
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const additionalItems = additionalFiles['libraries'];

  // 追加ファイルを処理
  for (const archive of additionalItems) {
    const destinationDir = path.join(destPath, archive.dest);

    // ダウンロード（キャッシュパスを取得）
    const cacheFilePath = await download(archive.url);

    if (cacheFilePath.endsWith('.zip')) {
      // アーカイブの場合は展開
      console.log(`add files to: ${destinationDir}/*`);
      await extract(cacheFilePath, destinationDir, archive.url);
    } else {
      // 通常ファイルの場合はコピー
      fs.mkdirSync(destinationDir, { recursive: true });
      const destinationFile = path.join(destinationDir, path.basename(archive.url));
      console.log(`add file to: ${destinationFile}`);
      copyFileWithSkip(cacheFilePath, destinationFile);
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
