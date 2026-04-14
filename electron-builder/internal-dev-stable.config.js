// @ts-check
// Dev environment build config (social-stable channel + dev server URLs)
// Requires: dev-hosts.json in project root (copy from private repo before packaging)
// Usage: NAIR_DEV_HOSTS=N pnpm package:internal-dev-stable

const config = require('./internal-stable.config.js');

config.productName += '(Dev)';
config.extraMetadata.buildProductName = config.productName;
// Signal to main.js that this is a dev-hosts build (no need to set NAIR_DEV_HOSTS at runtime)
config.extraMetadata.devHosts = 1;

// Include dev-hosts.json alongside main.js so the main process can load it at runtime
config.files = [...config.files, 'dev-hosts.json'];

module.exports = config;
