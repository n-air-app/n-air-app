import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsoncPlugin from 'eslint-plugin-jsonc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const OFF = 0;
const ERROR = 2;

const enable = (...rules) => Object.fromEntries(rules.map((rule) => [rule, ERROR]));
const enableStylistic = (...rules) => enable(...rules.map((rule) => `@stylistic/${rule}`));
const disableTypeScript = (...rules) => Object.fromEntries(
  rules.map((rule) => [`@typescript-eslint/${rule}`, OFF]),
);

const PLUGINS = {
  '@stylistic': stylistic,
  'simple-import-sort': simpleImportSort,
  'unused-imports': unusedImports,
};

// Format rules shared across JS/TS and Vue configs
const FORMAT_RULES = {
  ...enable('unicode-bom'),
  ...enableStylistic(
    'semi', 'eol-last', 'no-tabs', 'no-trailing-spaces',
  ),
  '@stylistic/indent': [ERROR, 2, { SwitchCase: 1 }],
  '@stylistic/brace-style': [ERROR, '1tbs', { allowSingleLine: true }],
  '@stylistic/quotes': [ERROR, 'single', { avoidEscape: true }],
  '@stylistic/comma-dangle': [ERROR, 'always-multiline'],
  '@stylistic/object-curly-spacing': [ERROR, 'always'],
  '@stylistic/no-multiple-empty-lines': [ERROR, { max: 1, maxBOF: 0, maxEOF: 1 }],
};

// Rules shared between JS/TS and Vue file configs
const COMMON_RULES = {
  ...enable(
    'no-eval', 'no-loop-func', 'no-template-curly-in-string', 'no-throw-literal',
    'prefer-rest-params', 'prefer-spread', 'no-duplicate-imports',
    'simple-import-sort/exports', 'unused-imports/no-unused-imports',
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

export default defineConfig([
  globalIgnores([
    'dist/',
    'bundles/',
    'test-dist/',
    'plugins/',
    'docs/',
    'nvoice/near/bundle.js*',
  ]),

  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
  },
  ...jsoncPlugin.configs['flat/recommended-with-jsonc'],
  ...vue.configs['flat/essential'],

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

  // Renderer code runs in Electron with browser APIs.
  {
    files: ['app/**/*.{js,ts}', 'obs-api/**/*.js', 'updater/ui.js'],
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
      ...disableTypeScript(
        'no-empty-object-type', 'no-explicit-any', 'no-require-imports',
        'no-unsafe-function-type', 'no-unused-expressions', 'no-unused-vars',
        'no-wrapper-object-types',
      ),
    },
  },
]);
