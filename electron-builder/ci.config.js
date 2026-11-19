// @ts-check
/**
 * CI専用ビルド設定
 * - NSIS圧縮を無効化してパッケージング高速化
 */

const config = require('./local.config.js');

// CI専用: NSIS圧縮を無効化してパッケージング高速化
// インストーラサイズは増えるが、CIでは配布しないので問題なし
config.compression = 'store';

module.exports = config;
