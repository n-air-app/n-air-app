import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';
import jsoncPlugin from 'eslint-plugin-jsonc';
import * as jsoncParser from 'jsonc-eslint-parser';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const OFF = 0;
const WARN = 1;
const ERROR = 2;

// Format rules shared across JS/TS and Vue configs
const FORMAT_RULES = {
  indent: [ERROR, 2, { SwitchCase: 1 }],
  'brace-style': [ERROR, '1tbs', { allowSingleLine: true }],
  quotes: [ERROR, 'single', { avoidEscape: true }],
  curly: [ERROR, 'multi-line'],
  'arrow-parens': [ERROR, 'always'],
  'no-trailing-spaces': ERROR,
  'no-multiple-empty-lines': [ERROR, { max: 1, maxBOF: 0, maxEOF: 1 }],
  'func-call-spacing': [ERROR, 'never'],
  'no-spaced-func': ERROR,
  'array-bracket-spacing': [ERROR, 'never'],
  'nonblock-statement-body-position': [ERROR, 'beside'],
  'wrap-iife': [ERROR, 'inside'],
  'quote-props': [ERROR, 'as-needed'],
};

// Rules shared between JS/TS and Vue file configs
const COMMON_RULES = {
  'prefer-arrow-callback': OFF,
  'generator-star-spacing': OFF,

  'import-name': OFF,
  'no-increment-decrement': OFF,
  'function-name': OFF,
  'no-boolean-literal-compare': OFF,

  // these rules have been disable after the migration from tslint
  // TODO: make decision about what rules we should enable
  'linebreak-style': OFF,
  'no-shadow': OFF,
  'consistent-return': OFF,
  'function-paren-newline': OFF,
  'implicit-arrow-linebreak': OFF,
  'prefer-destructuring': OFF,
  'dot-notation': OFF,
  'lines-between-class-members': OFF,
  'no-unused-vars': OFF,
  'import/extensions': OFF,
  'import/no-unresolved': OFF,
  'import/no-extraneous-dependencies': OFF,
  'import/newline-after-import': ERROR,
  'import/no-dynamic-require': OFF,
  'no-use-before-define': OFF,
  'global-require': OFF,
  'arrow-body-style': OFF,
  'no-cond-assign': OFF,
  'import/prefer-default-export': OFF,
  'new-cap': OFF,
  'no-param-reassign': OFF,
  'space-before-function-paren': OFF,
  'no-plusplus': OFF,
  'class-methods-use-this': OFF,
  'no-lonely-if': OFF,
  'import/order': OFF,
  'no-console': OFF,
  'operator-linebreak': OFF,
  'max-classes-per-file': OFF,
  'no-bitwise': OFF,
  'operator-assignment': OFF,
  'no-underscore-dangle': OFF,
  'prefer-object-spread': OFF,
  'max-len': OFF,
  'func-names': OFF,
  'no-multi-assign': OFF,
  'no-useless-escape': OFF,
  'no-return-assign': OFF,
  'no-empty': OFF,
  'no-unused-expressions': OFF,
  'no-return-await': OFF,
  'getter-return': OFF,
  'object-curly-newline': OFF,
  'no-useless-computed-key': OFF,
  'prefer-template': OFF,
  'no-void': OFF,
  camelcase: OFF,
  'no-restricted-globals': OFF,
  'no-alert': OFF,
  'default-case': OFF,
  'array-callback-return': OFF,
  'spaced-comment': OFF,
  'no-empty-function': OFF,
  'no-prototype-builtins': OFF,
  'no-else-return': OFF,
  'no-useless-constructor': OFF,
  'no-restricted-properties': OFF,
  'no-restricted-syntax': OFF,
  'no-dupe-class-members': OFF,
  'no-useless-return': OFF,
  'no-await-in-loop': OFF,
  'no-constant-condition': OFF,
  'guard-for-in': OFF,
  'no-continue': OFF,
  'no-confusing-arrow': OFF,
  'no-async-promise-executor': OFF,
  'prefer-promise-reject-errors': OFF,
  'import/first': ERROR,
  'import/no-duplicates': ERROR,
  'no-script-url': OFF,
  'import/no-named-default': OFF,

  'no-use-before-declare': OFF,
  'no-irregular-whitespace': OFF,
  'no-undef': OFF,

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

  // Vue-specific rules
  'vue/multi-word-component-names': OFF, // Many single-word component names (Login, Mixer, Tabs, etc.) exist; renaming would be a large-scale refactor

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
      'nvoice/near/bundle.js*',
    ],
  },

  // JSON / JSONC formatting (Prettier 廃止に伴い ESLint で format 管理)
  {
    files: ['**/*.json', '**/*.jsonc', '**/*.json5'],
    languageOptions: { parser: jsoncParser },
    plugins: { jsonc: jsoncPlugin },
    rules: {
      // JSON の strict な構文チェック
      'jsonc/no-bigint-literals': ERROR,
      'jsonc/no-binary-expression': ERROR,
      'jsonc/no-binary-numeric-literals': ERROR,
      'jsonc/no-escape-sequence-in-identifier': ERROR,
      'jsonc/no-hexadecimal-numeric-literals': ERROR,
      'jsonc/no-infinity': ERROR,
      'jsonc/no-multi-str': ERROR,
      'jsonc/no-nan': ERROR,
      'jsonc/no-number-props': ERROR,
      'jsonc/no-numeric-separators': ERROR,
      'jsonc/no-octal-numeric-literals': ERROR,
      'jsonc/no-parenthesized': ERROR,
      'jsonc/no-plus-sign': ERROR,
      'jsonc/no-regexp-literals': ERROR,
      'jsonc/no-template-literals': ERROR,
      'jsonc/no-undefined-value': ERROR,
      'jsonc/no-unicode-codepoint-escapes': ERROR,
      'jsonc/valid-json-number': ERROR,
      'jsonc/vue-custom-block/no-parsing-error': ERROR,
      'jsonc/no-dupe-keys': ERROR,

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
      'jsonc/no-irregular-whitespace': ERROR,
      'jsonc/no-useless-escape': ERROR,
      'jsonc/no-floating-decimal': ERROR,
    },
  },

  // tsconfig.json はコメントを許可（JSONC として扱う）
  {
    files: ['**/tsconfig.json', '**/tsconfig.*.json'],
    rules: {
      'jsonc/no-comments': OFF,
    },
  },

  // Base config for all JS/TS files
  ...compat.extends('airbnb-base'),
  js.configs.recommended,

  // Vue plugin configs (Vue 2)
  ...vue.configs['flat/vue2-essential'],

  // Main configuration for JS/TS files
  {
    files: ['**/*.{js,ts}'],

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      jest,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },

    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2018,
      sourceType: 'module',
      globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },

    rules: {
      ...COMMON_RULES,
    },
  },

  // Vue files configuration
  {
    files: ['**/*.vue'],

    plugins: {
      vue,
      '@typescript-eslint': tseslint.plugin,
      jest,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },

    languageOptions: {
      parser: vueParser,
      ecmaVersion: 2018,
      sourceType: 'module',
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaFeatures: { globalReturn: false }, // Fix: override airbnb-base's globalReturn:true that breaks vue/valid-v-for scope tracking
      },
      globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },

    rules: {
      ...COMMON_RULES,

      // The following are already ERROR in vue2-essential preset; listed explicitly for visibility
      'vue/no-use-v-if-with-v-for': ERROR,
      'vue/require-v-for-key': ERROR,
      'vue/valid-v-for': ERROR,

      // Vue template formatting
      'vue/html-indent': [ERROR, 2, {
        attribute: 1,
        baseIndent: 1,
        closeBracket: 0,
        alignAttributesVertically: true,
        ignores: [],
      }],
      'vue/max-attributes-per-line': OFF, // Don't enforce attribute line breaks
      'vue/html-closing-bracket-newline': OFF, // Don't enforce bracket newlines
      'vue/singleline-html-element-content-newline': OFF, // Don't enforce content newlines
      'vue/multiline-html-element-content-newline': OFF, // Don't enforce content newlines
    },
  },

  // TypeScript-specific overrides
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-undef': OFF,
      'default-param-last': OFF,
    },
  },
];
