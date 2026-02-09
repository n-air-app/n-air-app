const config = require('./stable.config.js');

config.productName += '(Local)';
delete config.publish;
delete config.upload;
config.extraMetadata.buildProductName = config.productName;

// ローカルビルドではコード署名をデフォルトで無効化
// CERTIFICATE_SUBJECT_NAME が設定されている場合のみ有効化（署名確認用）
if (!process.env.CERTIFICATE_SUBJECT_NAME && config.win) {
  config.win.signAndEditExecutable = false;
  delete config.win.signtoolOptions;
}

module.exports = config;
