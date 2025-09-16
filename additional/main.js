// additional.jsonに記載された追加ファイルをダウンロード・展開・コピーするスクリプト
// 主にobs-studio-nodeのネイティブライブラリを配置するために使用
// Windows環境で動作することを想定しています

import { spawn } from 'child_process';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

import additionalFiles from './additional.json' with { type: 'json' };

// 出力ディレクトリのパス
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST = path.resolve(__dirname, '../');

// 指定したURLからファイルをダウンロードする
// @param url ダウンロード元URL
// @param destinationPath 保存先パス
async function download(url, destinationPath) {

  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // リダイレクトの場合は再帰的に処理
        return download(response.headers.location, destinationPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(destinationPath, buffer);
        resolve();
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// アーカイブを展開
// @param sourcePath 展開元アーカイブパス
// @param destinationPath 展開先ディレクトリパス
async function extract(sourcePath, destinationPath) {
  return new Promise((resolve, reject) => {
    console.log(`展開中: ${sourcePath} → ${destinationPath}`);
    
    // 展開先ディレクトリを作成
    fs.mkdirSync(destinationPath, { recursive: true });

    // ZIPの場合はPowerShellのExpand-Archiveを使用
    const process = spawn('pwsh',['-Command', `Expand-Archive -Path "${sourcePath}" -DestinationPath "${destinationPath}" -Force`]);
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Archive extraction failed with code ${code}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  const additionalItems = additionalFiles['libraries'];

  // 一時ディレクトリのパス
  const tempDirectory = `./__temp/`;
  fs.mkdirSync(tempDirectory, { recursive: true });

  // 追加ファイルを処理
  for (const archive of additionalItems) {
    const archiveFilename = path.basename(archive.url);
    const archiveFilePath = `${tempDirectory}${archiveFilename}`;

    // 追加ファイルをダウンロード
    console.log(`ダウンロード中: ${archive.url} → ${archiveFilePath}`);
    await download(archive.url, archiveFilePath, true);

    // アーカイブの種類によって処理を分岐
    if (archiveFilePath.endsWith('.zip')) {
      // アーカイブの場合は展開
      await extract(archiveFilePath, `${DEST}${archive.dest}`);
    } else {
      // 通常ファイルの場合はコピー
      const destinationDir = `${DEST}${archive.dest}`;
      const destinationFile = path.join(destinationDir, archiveFilename);

      // 保存先ディレクトリが存在しない場合は作成
      fs.mkdirSync(destinationDir, { recursive: true });

      console.log(`コピー中: ${archiveFilePath} → ${destinationFile}`);
      fs.copyFileSync(archiveFilePath, destinationFile);
    }
  }

  fs.rmSync(tempDirectory, { recursive: true });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.log(error);
    process.exit(1);
  });
