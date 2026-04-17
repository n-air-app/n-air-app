const fs = require('fs');
const path = require('path');

const config = require('./stable.config.js');

if (!process.env.INTERNAL_PUBLISH_URL) {
  throw new Error('INTERNAL_PUBLISH_URL is not given');
}

config.productName += '(社内版)';
config.publish.url = `${process.env.INTERNAL_PUBLISH_URL}/windows`;
config.extraMetadata.buildProductName = config.productName;

// dev-hosts.json が存在する場合は自動的にdev-hosts対応ビルドにする
if (fs.existsSync(path.join(__dirname, '..', 'dev-hosts.json'))) {
  config.extraMetadata.devHosts = 1;
  config.files = [...config.files, 'dev-hosts.json'];
}

module.exports = config;
