module.exports = {
  roots: ['<rootDir>/bin'],
  testMatch: ['**/bin/**/*.test.js'],
  // ESM 専用の依存を本物のまま読み込むため node:test で実行する (`pnpm run test:integration:bin`)
  testPathIgnorePatterns: ['/node_modules/', '/bin/release/integration-tests/'],
};
