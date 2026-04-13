// eslint.config.js — Flat config for ESLint 10 (Vue 3 + TypeScript)
import pluginVue from 'eslint-plugin-vue'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import vueParser from 'vue-eslint-parser'

export default [
  // ── Ignore patterns ──────────────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
    ],
  },

  // ── TypeScript source files (.ts) ────────────────────────────────────────
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // TypeScript recommended (subset — no type-aware rules to keep it fast)
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
  },

  // ── Vue SFC files (.vue) ─────────────────────────────────────────────────
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue: pluginVue,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Vue 3 essentials
      'vue/multi-word-component-names': 'off',  // single-word names ok for pages
      'vue/no-unused-vars': 'warn',
      'vue/no-unused-components': 'warn',
      'vue/no-v-html': 'warn',
      'vue/require-v-for-key': 'error',
      'vue/no-use-v-if-with-v-for': 'error',
      'vue/html-self-closing': ['warn', {
        html: { void: 'always', normal: 'always', component: 'always' },
        svg: 'always',
        math: 'always',
      }],
      // TypeScript in .vue
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-debugger': 'error',
    },
  },

  // ── Test files — relax some rules ────────────────────────────────────────
  {
    files: ['src/**/*.test.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
]
