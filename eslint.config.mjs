import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jsoncPlugin from 'eslint-plugin-jsonc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const OFF = 0;
const ERROR = 2;

const GLOBALS = {
  ...globals.browser,
  ...globals.node,
  ...globals.jest,
};

const PLUGINS = {
  import: importPlugin,
  'simple-import-sort': simpleImportSort,
  'unused-imports': unusedImports,
};

// Format rules shared across JS/TS and Vue configs
const FORMAT_RULES = {
  indent: [ERROR, 2, { SwitchCase: 1 }],
  'brace-style': [ERROR, '1tbs', { allowSingleLine: true }],
  quotes: [ERROR, 'single', { avoidEscape: true }],
  semi: ERROR,
  'semi-spacing': ERROR,
  'semi-style': ERROR,
  'comma-dangle': [ERROR, 'always-multiline'],
  'comma-spacing': ERROR,
  'comma-style': ERROR,
  curly: [ERROR, 'multi-line'],
  'arrow-parens': ERROR,
  'arrow-spacing': ERROR,
  'block-spacing': ERROR,
  'computed-property-spacing': ERROR,
  'key-spacing': ERROR,
  'keyword-spacing': ERROR,
  'object-curly-spacing': [ERROR, 'always'],
  'object-property-newline': [ERROR, { allowAllPropertiesOnSameLine: true }],
  'rest-spread-spacing': ERROR,
  'space-before-blocks': ERROR,
  'space-in-parens': ERROR,
  'space-infix-ops': ERROR,
  'space-unary-ops': [ERROR, { words: true, nonwords: false }],
  'switch-colon-spacing': ERROR,
  'template-curly-spacing': ERROR,
  'yield-star-spacing': ERROR,
  'eol-last': ERROR,
  'new-parens': ERROR,
  'no-mixed-spaces-and-tabs': ERROR,
  'no-tabs': ERROR,
  'no-trailing-spaces': ERROR,
  'no-multiple-empty-lines': [ERROR, { max: 1, maxBOF: 0, maxEOF: 1 }],
  'no-whitespace-before-property': ERROR,
  'unicode-bom': ERROR,
  'func-call-spacing': ERROR,
  'array-bracket-spacing': ERROR,
  'nonblock-statement-body-position': ERROR,
  'wrap-iife': [ERROR, 'inside'],
  'quote-props': [ERROR, 'as-needed'],
};

// Rules shared between JS/TS and Vue file configs
const COMMON_RULES = {
  // Overrides for rules enabled by @eslint/js recommended
  'no-unused-vars': OFF,
  'no-cond-assign': OFF,
  'no-useless-escape': OFF,
  'no-empty': OFF,
  'getter-return': OFF,
  'no-prototype-builtins': OFF,
  'no-dupe-class-members': OFF,
  'no-constant-condition': OFF,
  'no-async-promise-executor': OFF,
  'no-irregular-whitespace': OFF,
  'no-undef': OFF,

  // Additional code quality rules
  'no-eval': ERROR,
  'no-loop-func': ERROR,
  'no-template-curly-in-string': ERROR,
  'no-throw-literal': ERROR,
  'prefer-rest-params': ERROR,
  'prefer-spread': ERROR,
  'import/newline-after-import': ERROR,
  'import/first': ERROR,
  'import/no-duplicates': ERROR,

  'simple-import-sort/imports': [ERROR, {
    groups: [
      // Side-effect imports
      ['^\\u0000'],
      // Node.js builtins: exact module names (to avoid matching internal paths like util/)
      ['^node:', '^(crypto|fs|path|os|http|https|util|stream|url|child_process|events|net)$'],
      // External npm packages and internal absolute imports (both are bare module specifiers)
      ['^@?[^.]'],
      // Parent relative imports
      ['^\\.\\./'],
      // Sibling relative imports
      ['^\\.'],
    ],
  }],
  'simple-import-sort/exports': ERROR,
  'unused-imports/no-unused-imports': ERROR,

  // Also applies to virtual `.vue.ts` files created by the Vue processor.
  'vue/multi-word-component-names': OFF,

  ...FORMAT_RULES,
};

export default [
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'bundles/**',
      'test-dist/**',
      'plugins/**',
      'bin/node_modules/**',
      'docs/**',
      'nvoice/near/bundle.js*',
    ],
  },

  js.configs.recommended,
  ...jsoncPlugin.configs['flat/recommended-with-jsonc'],
  ...vue.configs['flat/essential'],

  // JSON / JSONC formatting (Prettier 廃止に伴い ESLint で format 管理)
  {
    files: ['**/*.json', '**/*.jsonc', '**/*.json5'],
    rules: {
      // フォーマット（2スペース・ダブルクォート・末尾カンマなし）
      'jsonc/indent': [ERROR, 2],
      'jsonc/key-spacing': [ERROR, { beforeColon: false, afterColon: true }],
      'jsonc/comma-style': [ERROR, 'last'],
      'jsonc/comma-dangle': [ERROR, 'never'],
      'jsonc/quotes': [ERROR, 'double'],
      'jsonc/quote-props': [ERROR, 'always'],
      'jsonc/array-bracket-spacing': [ERROR, 'never'],
      'jsonc/object-curly-spacing': [ERROR, 'always'],
      'jsonc/object-curly-newline': [ERROR, { multiline: true, consistent: true }],
      'jsonc/object-property-newline': [ERROR, { allowAllPropertiesOnSameLine: true }],
    },
  },

  // Main configuration for JS/TS files
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    plugins: PLUGINS,

    languageOptions: {
      parser: tseslint.parser,
      globals: GLOBALS,
    },

    rules: COMMON_RULES,
  },

  // Vue files configuration
  {
    files: ['**/*.vue'],
    plugins: PLUGINS,

    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
      globals: GLOBALS,
    },

    rules: {
      ...COMMON_RULES,

      'vue/html-indent': [ERROR, 2, {
        attribute: 1,
        baseIndent: 1,
        closeBracket: 0,
        alignAttributesVertically: true,
        ignores: [],
      }],
    },
  },

  // TypeScript-specific overrides
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-redeclare': OFF,
    },
  },
];
