// lint-staged configuration
// 大量のファイルがある場合のメモリ不足対策

// Node.js のメモリ制限を増やす
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

module.exports = {
  // TypeScript, JavaScript, Vue ファイル
  '*.{ts,vue}': ['eslint'],

  // CSS, Less, Vue スタイル
  '*.{css,less,vue}': ['stylelint'],

  // 国際化ファイル
  'app/i18n/*/*.json': ['node ./bin/i18n-early-check.js'],

  // フォントグリフ
  '{app/fonts/glyphs/*.svg,app/styles/custom-icons.less.njk}': [
    'pnpm run webfont',
    'git add app/fonts/n-air.woff app/styles/custom-icons.less',
  ],
};
