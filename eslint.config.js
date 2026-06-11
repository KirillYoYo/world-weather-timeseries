import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import prettierPlugin from 'eslint-plugin-prettier' // 🔥 Prettier
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'

export default tseslint.config(
    js.configs.recommended,

    // TypeScript
    ...tseslint.configs.recommended,
    importPlugin.flatConfigs.recommended,

    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'vite/config.*.mjs',
            '*.config.mjs',
            'vite-env.d.ts',
            'eslint.config.js',
        ],
    },

    // {
    //   name: 'prettier',
    //   plugins: {
    //     prettier: (await import('eslint-plugin-prettier')).default,
    //   },
    //   rules: {
    //     'prettier/prettier': 'error',
    //   },
    // },

    {
        ignores: ['dist/**', 'node_modules/**'],
    },

    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                process: 'readonly',
                module: 'readonly',
                require: 'readonly',
            },

            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            prettier: prettierPlugin,
        },
        settings: {
            'import/resolver': {
                typescript: createTypeScriptImportResolver({
                    project: './tsconfig.json',
                }),
                node: {
                    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
                    // разрешаем все node_modules
                    moduleDirectory: ['node_modules', 'src'],
                },
            },
        },
        rules: {
            'prettier/prettier': 'error',

            'no-console': 'off', // console.log в dev
            'no-var': 'error', // Только let/const
            'prefer-const': 'error',

            // TypeScript (баланс строгости)
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn', // Не any, но не error

            'no-param-reassign': 'off',
            'prefer-object-spread': 'warn', // this.sprite.setScale(1.1) OK

            'import/order': [
                'error',
                {
                    groups: [
                        'builtin',
                        'external',
                        'internal',
                        'parent',
                        'sibling',
                        'index',
                        'object',
                    ],
                    'newlines-between': 'always',
                    pathGroups: [{ pattern: 'phaser', group: 'external', position: 'before' }],
                },
            ],

            // Функционалка
            eqeqeq: ['error', 'always', { null: 'ignore' }], // == null OK
            curly: ['error', 'multi-line'], // if без {} только 1 строка
            'eol-last': 'error',
        },
    },
    {
        files: ['**/*.{js, mjs}'],
        languageOptions: {
            globals: {
                process: 'readonly',
                module: 'readonly',
                require: 'readonly',
            },
        },
    }
)