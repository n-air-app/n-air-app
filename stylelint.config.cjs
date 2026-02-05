/** @type {import('stylelint').Config} */
module.exports = {
  plugins: ['stylelint-less'],
  extends: [
    'stylelint-config-standard',
    'stylelint-config-recess-order',
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
        ignoreFontFamilies: ['n-air', 'Roboto'],
      },
    ],
    'function-no-unknown': [
      true,
      { ignoreFunctions: ['lighten', 'darken', 'fade', 'fadein', 'fadeout'] },
    ],
    'color-function-notation': null,
    'block-no-empty': null,

    // v16 new rules: disable for LESS compatibility or project preferences
    'color-function-alias-notation': null, // LESS uses rgba() with variables
    'property-no-deprecated': null, // word-wrap still widely used
  },
  overrides: [
    {
      files: ['**/*{.html,.vue}'],
      customSyntax: 'postcss-html',
      rules: {
        // LESS variables in Vue <style lang="less"> blocks
        'declaration-property-value-no-unknown': null,
      },
    },
    {
      files: ['**/*.less'],
      ignoreFiles: ['app/styles/custom-icons.less'], // 自動生成のため除外
      customSyntax: 'postcss-less',
      rules: {
        // LESS variables and operations are not recognized by standard CSS validators
        'declaration-property-value-no-unknown': null,
      },
    },
  ],
};
