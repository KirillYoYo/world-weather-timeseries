import js from '@eslint/js'
import ts from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import * as path from 'node:path'

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
    {
        ignores: ['node_modules/**', '.next/**', 'dist/**'],
    },
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: ts.parser,
            parserOptions: {
                ecmaFeatures: { jsx: true },
                projectService: true,
                tsconfigRootDir: path.resolve('.'),
            },
        },
        plugins: {
            '@typescript-eslint': ts.plugin,
            react,
            'react-hooks': reactHooks,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            // Базовые правила JS/TS
            ...js.configs.recommended.rules,
            ...ts.configs.recommendedTypeChecked.rules,

            // React
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,

            // Code style (можно подкручивать)
            'quotes': ['error', 'single', { avoidEscape: true }],
            'semi': ['error', 'never'],
            'comma-dangle': ['error', 'always-multiline'],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'indent': ['error', 4, { SwitchCase: 1, flatTernaryExpressions: false }],
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],

            // React‑специфичное
            'react/react-in-jsx-scope': 'off', // в Next/React 17+ не нужно
            'react/jsx-uses-react': 'off',
            'react/jsx-indent': ['error', 4],
            'react/jsx-indent-props': ['error', 4],

            // Hooks
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            // TypeScript tweaks
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePatterns: '^_' },
            ],
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
]
