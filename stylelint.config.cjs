module.exports = {
  plugins: ['stylelint-less'],
  extends: [
    'stylelint-config-standard',
    'stylelint-config-recess-order',
    'stylelint-config-prettier',
  ],
  rules: {
    // ルールは随時追加する
    'declaration-block-no-redundant-longhand-properties': null,
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'selector-not-notation': 'simple',
    'font-family-no-missing-generic-family-keyword': [
      true,
      {
        ignoreFontFamilies: 'n-air',
      },
    ],
    'function-no-unknown': [
      true,
      { ignoreFunctions: ['lighten', 'darken', 'fade', 'fadein', 'fadeout'] },
    ],
    'color-function-notation': 'legacy',
  },
  overrides: [
    {
      files: ['**/*{.html,.vue}'],
      customSyntax: 'postcss-html',
    },
    {
      files: ['**/*.less'],
      customSyntax: 'postcss-less',
    },
  ],
};
