import js from '@eslint/js'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import { architecture } from './eslint.architecture.mjs'

export default tseslint.config(
  { ignores: ['node_modules/**', 'coverage/**', 'contract/reports/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'simple-import-sort/imports': [
        'error',
        {
          // Ordre de standards-front, adapté à l'API : 1 tiers (Node et paquets), 2 socle, 3 modules dans l'ordre
          // des couches domain, application, infrastructure, http, 4 composition (app, config, database),
          // 5 relatifs, 6 types, 7 effets de bord. Le socle est exclu des motifs de couches : l'import va au motif
          // qui correspond sur la plus grande longueur.
          groups: [
            ['^node:', '^@?\\w'],
            ['^#/shared/'],
            ['domain', 'application', 'infrastructure', 'http'].map(
              (layer) => `^#/(?!shared/)[^/]+/${layer}/`,
            ),
            ['^#/'],
            ['^\\.'],
            ['^.+\\u0000$'],
            ['^\\u0000'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
  ...architecture,
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
)
