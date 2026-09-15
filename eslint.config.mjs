import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import jsoncPlugin from 'eslint-plugin-jsonc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const OFF = 0;
const ERROR = 2;

const enable = (...rules) => Object.fromEntries(rules.map((rule) => [rule, ERROR]));
const disable = (...rules) => Object.fromEntries(rules.map((rule) => [rule, OFF]));
const enableStylistic = (...rules) => enable(...rules.map((rule) => `@stylistic/${rule}`));

const PLUGINS = {
  '@stylistic': stylistic,
  import: importPlugin,
  'simple-import-sort': simpleImportSort,
  'unused-imports': unusedImports,
};

// Format rules shared across JS/TS and Vue configs
const FORMAT_RULES = {
  ...enable(
    'semi-spacing', 'key-spacing', 'unicode-bom', 'func-call-spacing',
  ),
  ...enableStylistic(
    'semi', 'semi-style', 'comma-spacing', 'comma-style', 'arrow-parens', 'arrow-spacing',
    'block-spacing', 'computed-property-spacing', 'keyword-spacing', 'rest-spread-spacing',
    'space-before-blocks', 'space-in-parens', 'space-infix-ops', 'switch-colon-spacing',
    'template-curly-spacing', 'yield-star-spacing', 'eol-last', 'new-parens',
    'no-mixed-spaces-and-tabs', 'no-tabs', 'no-trailing-spaces', 'no-whitespace-before-property',
    'array-bracket-spacing', 'nonblock-statement-body-position',
  ),
  indent: [ERROR, 2, { SwitchCase: 1 }],
  'quote-props': [ERROR, 'as-needed'],
  '@stylistic/brace-style': [ERROR, '1tbs', { allowSingleLine: true }],
  '@stylistic/quotes': [ERROR, 'single', { avoidEscape: true }],
  '@stylistic/comma-dangle': [ERROR, 'always-multiline'],
  curly: [ERROR, 'multi-line'],
  '@stylistic/object-curly-spacing': [ERROR, 'always'],
  '@stylistic/object-property-newline': [ERROR, { allowAllPropertiesOnSameLine: true }],
  '@stylistic/space-unary-ops': [ERROR, { words: true, nonwords: false }],
  '@stylistic/no-multiple-empty-lines': [ERROR, { max: 1, maxBOF: 0, maxEOF: 1 }],
  '@stylistic/wrap-iife': [ERROR, 'inside'],
};

// Rules shared between JS/TS and Vue file configs
const COMMON_RULES = {
  ...enable(
    'no-eval', 'no-loop-func', 'no-template-curly-in-string', 'no-throw-literal',
    'prefer-rest-params', 'prefer-spread', 'import/newline-after-import', 'import/first',
    'import/no-duplicates', 'simple-import-sort/exports', 'unused-imports/no-unused-imports',
  ),

  // Existing code migration backlog for @eslint/js recommended.
  ...disable(
    'no-unused-vars', 'no-cond-assign', 'no-useless-escape', 'no-empty', 'getter-return',
    'no-prototype-builtins', 'no-async-promise-executor', 'no-irregular-whitespace',
  ),

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
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
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

  // Rules shared by JavaScript, TypeScript, and Vue.
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    plugins: PLUGINS,
    rules: COMMON_RULES,
  },

  // Main configuration for JS/TS files
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      parser: tseslint.parser,
      globals: globals.node,
    },
  },

  // Renderer code runs in Electron with both browser and Node.js APIs.
  {
    files: ['app/**/*.{js,ts}'],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Test files additionally use Jest globals.
  {
    files: ['**/*.test.{js,ts}', 'test/**/*.{js,ts}', 'app/test-setup/**/*.{js,ts}'],
    languageOptions: {
      globals: globals.jest,
    },
  },

  // Values injected by webpack's DefinePlugin.
  {
    files: ['sentry-defs.js'],
    languageOptions: {
      globals: {
        SENTRY_DSN: 'readonly',
        SENTRY_MINIDUMP_URL: 'readonly',
      },
    },
  },

  // Vue files configuration
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
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
      // Existing code migration backlog for typescript-eslint recommended.
      ...disable(
        'no-undef', 'no-redeclare', '@typescript-eslint/ban-ts-comment',
        '@typescript-eslint/no-empty-object-type', '@typescript-eslint/no-explicit-any',
        '@typescript-eslint/no-require-imports', '@typescript-eslint/no-unsafe-function-type',
        '@typescript-eslint/no-unused-expressions', '@typescript-eslint/no-unused-vars',
        '@typescript-eslint/no-wrapper-object-types', '@typescript-eslint/triple-slash-reference',
      ),
    },
  },
];
