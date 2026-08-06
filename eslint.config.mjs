import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptRules from 'eslint-config-next/typescript';

/**
 * Configuración plana de ESLint 9.
 * eslint-config-next 16 ya exporta configuraciones planas, así que no hace
 * falta el puente FlatCompat.
 */
const config = [
  ...coreWebVitals,
  ...typescriptRules,
  {
    ignores: ['_mock/**', '.next/**', 'node_modules/**', 'src/types/database.ts', 'coverage/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
];

export default config;
