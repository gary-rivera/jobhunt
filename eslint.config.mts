import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      // 'no-unused-imports': 'error',
      'no-async-promise-executor': 'error',
      'no-unreachable': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'warn',
    },
  },

  tseslint.configs.recommended,
  prettierConfig,
]);
