import js from '@eslint/js';
import globals from 'globals';

// Pack modules use only ctx and their imports ('three', 'cozy/kit.js'), not globals (stack ADR-001, NFR-8).
const PACK_GLOBALS = ['window', 'document', 'localStorage', 'sessionStorage', 'THREE', 'AFRAME'].map((name) => ({
  name,
  message: 'A pack uses ctx and its imports, not globals (ADR-001).'
}));

export default [
  {
    ignores: [
      '_site/',
      '_site-dev/',
      '_site-fixture/',
      '_site-button/',
      '_site-url/',
      '.jekyll-cache/',
      'node_modules/',
      'vendor/',
      'test-results/',
      'playwright-report/'
    ]
  },
  js.configs.recommended,
  {
    // Core browser modules. A-Frame supplies THREE and AFRAME as globals.
    files: ['assets/js/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser, THREE: 'readonly', AFRAME: 'readonly' }
    }
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node }
  },
  {
    // Callbacks given to page.evaluate() run in the browser.
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.browser, THREE: 'readonly' } }
  },
  {
    files: ['packs/**/*.js', 'tests/fixtures/packs/**/*.js'],
    languageOptions: { sourceType: 'module' },
    rules: { 'no-restricted-globals': ['error', ...PACK_GLOBALS] }
  },
  {
    // Only the root pack may load the shared nature kit (risk R2, deviation DV-1).
    files: ['packs/*/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/assets\\/models/]',
          message: 'A child pack keeps its own models in models/ (ADR-001, risk R2).'
        }
      ]
    }
  }
];
