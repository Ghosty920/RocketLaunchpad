import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

export default defineConfig(js.configs.recommended, ts.configs.recommended, {
	rules: {
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-unused-vars': 'off',
	},
	languageOptions: {
		globals: {
			...globals.browser,
			...globals.node,
		},
	},
});
