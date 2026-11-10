import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    // Logika her i sdílené části musí jít testovat bez prohlížeče, proto v ní
    // Phaser nesmí být. Hranice mezi částmi hlídá tests/shared/boundaries.test.ts.
    files: ['src/shared/logic/**/*.ts', 'src/games/*/logic/**/*.ts', 'src/menu/logic/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['phaser', 'phaser/*'] }],
    },
  },
);
