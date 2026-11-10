import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import { bookAt, layoutPicker, previewAt } from '../../../src/games/coloring/logic/pickerLayout';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { viewportOf } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS } from './coloringLayoutScenes';

/**
 * Test k #126 AC4: ťuknutí na knihu se pozná v logice. Jedno pravidlo
 * v cyklu přes okna testů rozložení Omalovánek.
 */
describe('#126: ťuknutí na knihu na výběru', () => {
  it('ťuknutí doprostřed knihy trefí knihu, ne náhled; ťuknutí na náhled knihu netrefí', () => {
    for (const window of COLORING_WINDOWS) {
      const layout = layoutPicker(gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT));
      const { book } = layout;
      const bookX = book.left + book.width / 2;
      const bookY = book.top + book.height / 2;
      expect(bookAt(layout, bookX, bookY), `${window.name}: střed knihy`).toBe(true);
      expect(previewAt(layout, bookX, bookY), `${window.name}: střed knihy není náhled`).toBe(null);
      expect(bookAt(layout, book.left - 1, bookY), `${window.name}: vlevo vedle knihy`).toBe(false);
      for (const [index, preview] of layout.previews.entries()) {
        const x = preview.left + preview.width / 2;
        const y = preview.top + preview.height / 2;
        expect(bookAt(layout, x, y), `${window.name}: náhled ${index} není kniha`).toBe(false);
      }
    }
  });
});
