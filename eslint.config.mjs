import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';
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
      'prefer-arrow-callback': OFF,
      'brace-style': OFF,
      'generator-star-spacing': OFF,
      indent: OFF,

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
      'arrow-parens': OFF,
      'prefer-destructuring': OFF,
      'dot-notation': OFF,
      'lines-between-class-members': OFF,
      'no-unused-vars': OFF,
      'import/extensions': OFF,
      'import/no-unresolved': OFF,
      'import/no-extraneous-dependencies': OFF,
      'import/newline-after-import': OFF,
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
      'quote-props': OFF,
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
      'import/first': OFF,
      'no-script-url': OFF,
      'import/no-named-default': OFF,

      'no-use-before-declare': OFF,
      'no-irregular-whitespace': OFF,
      'no-undef': OFF,

      // Vue-specific rules
      'vue/multi-word-component-names': OFF, // Many single-word component names (Login, Mixer, Tabs, etc.) exist; renaming would be a large-scale refactor

      // Prettier compatibility: disable style rules that Prettier handled
      quotes: OFF,
      curly: OFF,
      'nonblock-statement-body-position': OFF,
      'no-spaced-func': OFF,
      'func-call-spacing': OFF,
      'array-bracket-spacing': OFF,
      'no-multiple-empty-lines': OFF,
      'no-trailing-spaces': OFF,
      'wrap-iife': OFF,
    },
  },

  // Vue files configuration
  {
    files: ['**/*.vue'],

    plugins: {
      vue,
      '@typescript-eslint': tseslint.plugin,
      jest,
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
      'prefer-arrow-callback': OFF,
      'brace-style': OFF,
      'generator-star-spacing': OFF,
      indent: OFF,

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
      'arrow-parens': OFF,
      'prefer-destructuring': OFF,
      'dot-notation': OFF,
      'lines-between-class-members': OFF,
      'no-unused-vars': OFF,
      'import/extensions': OFF,
      'import/no-unresolved': OFF,
      'import/no-extraneous-dependencies': OFF,
      'import/newline-after-import': OFF,
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
      'quote-props': OFF,
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
      'import/first': OFF,
      'no-script-url': OFF,
      'import/no-named-default': OFF,

      'no-use-before-declare': OFF,
      'no-irregular-whitespace': OFF,
      'no-undef': OFF,

      // Vue-specific rules
      'vue/multi-word-component-names': OFF, // Many single-word component names (Login, Mixer, Tabs, etc.) exist; renaming would be a large-scale refactor
      // The following are already ERROR in vue2-essential preset; listed explicitly for visibility
      'vue/no-use-v-if-with-v-for': ERROR,
      'vue/require-v-for-key': ERROR,
      'vue/valid-v-for': ERROR,

      // Prettier compatibility: disable style rules that Prettier handled
      quotes: OFF,
      curly: OFF,
      'nonblock-statement-body-position': OFF,
      'no-spaced-func': OFF,
      'func-call-spacing': OFF,
      'array-bracket-spacing': OFF,
      'no-multiple-empty-lines': OFF,
      'no-trailing-spaces': OFF,
      'wrap-iife': OFF,

      // Vue template formatting
      'vue/html-indent': [ERROR, 2, {
        attribute: 1,
        baseIndent: 1,
        closeBracket: 0,
        alignAttributesVertically: true,
        ignores: []
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
