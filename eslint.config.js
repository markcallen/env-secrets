const globals = require('globals');
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

const tsEslintRecommendedRules =
  tsPlugin.configs['eslint-recommended']?.overrides?.[0]?.rules ?? {};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'website/build/**',
      'website/node_modules/**',
      'website/.docusaurus/**',
      'coverage/**',
      'coverage-e2e/**'
    ]
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ...(js.configs.recommended.languageOptions ?? {}),
      globals: globals.node
    },
    rules: {
      ...(js.configs.recommended.rules ?? {}),
      'no-console': 'warn'
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...(js.configs.recommended.rules ?? {}),
      ...tsEslintRecommendedRules,
      ...(tsPlugin.configs.recommended.rules ?? {}),
      'no-console': 'warn'
    }
  },
  {
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      'prettier/prettier': 'error'
    }
  },
  prettierConfig
];
