/**
 * CI専用ビルド設定
 * - NSIS圧縮を無効化してパッケージング高速化
 *
 * NOTE: @ts-check を付けていない理由:
 * electron-builder の Configuration 型は compression を readonly で定義しているが、
 * 他の *.config.js と同様に require() 後にプロパティを上書きするパターンを使用するため。
 */

const config = require('./local.config.js');

// CI専用: NSIS圧縮を無効化してパッケージング高速化
// インストーラサイズは増えるが、CIでは配布しないので問題なし
config.compression = 'store';

module.exports = config;
