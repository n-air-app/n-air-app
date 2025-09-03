// PCゲームキャプチャ：自動　でのアプリケーションリストの更新スクリプト
// アプリケーションリストはアプリにバンドルします
// そんなに更新されないのでたまに手動更新ぐらいでよいです
//
// node bin/update-gamecaptue.js

const https = require('https');
const fs = require('fs/promises');
const path = require('path');

const listUrl = 'https://slobs-cdn.streamlabs.com/configs/game_capture_list.json';
const outputPath = path.join(__dirname, '../assets/gamecapture/game_capture_list.json');

async function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    console.log('Updating game_capture_list.json from', listUrl);
    console.log('Output path:', outputPath);
    const data = await download(listUrl);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, data, 'utf8');
    console.log('game_capture_list.json を更新しました。');
  } catch (e) {
    console.error('エラー:', e.message);
  }
}

main();
