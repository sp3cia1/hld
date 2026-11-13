import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Layer rules from AGENTS.md. Each block targets different files, so none overrides another.
const noPrisma = [
  {
    group: ['@prisma/*', '**/generated/**', '**/lib/prisma'],
    message: 'Only repositories touch the database.',
  },
];
const noExpress = [
  { group: ['express'], message: 'Express stays in routes, controllers and middleware.' },
];
const noUpperLayers = [
  {
    group: ['**/*.service', '**/*.controller'],
    message: 'Lower layers never import upper layers.',
  },
];

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'apps/api/src/generated/**', 'data/**'] },

  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
      // Named exports only.
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'scripts/**/*.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
  { files: ['apps/web/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },

  // controller: validates input, calls the service. No repositories, no Prisma.
  {
    files: ['apps/api/src/**/*.controller.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...noPrisma,
            {
              group: ['**/*.repository'],
              message: 'Controllers call services, never repositories.',
            },
          ],
        },
      ],
    },
  },
  // service: business rules and transactions. No Express, no Prisma (use lib/transaction.ts).
  {
    files: ['apps/api/src/**/*.service.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [...noPrisma, ...noExpress] }] },
  },
  // repository: data access only.
  {
    files: ['apps/api/src/**/*.repository.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [...noExpress, ...noUpperLayers] }] },
  },
  // logic: pure functions. No I/O, and `now` is a parameter, never read from the clock.
  {
    files: ['apps/api/src/**/*.logic.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...noPrisma,
            ...noExpress,
            ...noUpperLayers,
            { group: ['**/*.repository'], message: 'Logic is pure: no data access.' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Logic must not read the clock. Take `now` as a parameter.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Logic must not read the clock. Take `now` as a parameter.',
        },
      ],
    },
  },

  // Tooling files: default exports are required, and there is no tsconfig for type-aware rules.
  {
    files: ['**/*.config.{js,ts}'],
    rules: { 'no-restricted-exports': 'off' },
  },
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
  // Scripts print to the terminal on purpose.
  { files: ['scripts/**/*.{ts,js}'], rules: { 'no-console': 'off' } },
);
