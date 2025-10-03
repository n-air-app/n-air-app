// PCゲームキャプチャ：自動　でのアプリケーションリストの更新スクリプト
// アプリケーションリストはアプリにバンドルします
// そんなに更新されないのでたまに手動更新ぐらいでよいです
//
// node bin/update-gamecaptue.js

const fs = require('node:fs');
const path = require('node:path');

const listUrl = 'https://slobs-cdn.streamlabs.com/configs/game_capture_list.json';
const outputPath = path.join(__dirname, '../assets/gamecapture/game_capture_list.json');

async function main() {
  try {
    console.log('game_capture_list.json を更新中...');

    const response = await fetch(listUrl);
    if (!response.ok) {
      throw new Error(`リクエストが失敗しました。ステータスコード: ${response.status}`);
    }

    const newData = await response.text();

    // 既存ファイルの確認
    let existingData = '';
    try {
      existingData = fs.readFileSync(outputPath, 'utf8');
    } catch (err) {
      console.log('既存ファイルが見つかりません。新規作成します。');
    }

    // 変化の確認
    const hasChanged = newData !== existingData;

    if (hasChanged) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, newData, 'utf8');
      console.log('game_capture_list.json を更新しました。（変更あり）');
    } else {
      console.log('game_capture_list.json は最新版です。（変更なし）');
    }
  } catch (e) {
    console.error('エラー:', e.message);
  }
}

main();
