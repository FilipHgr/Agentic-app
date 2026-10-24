import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    // Logika hry musí jít testovat bez prohlížeče, proto v ní Phaser nesmí být.
    files: ['src/logic/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['phaser', 'phaser/*'] }],
    },
  },
);
