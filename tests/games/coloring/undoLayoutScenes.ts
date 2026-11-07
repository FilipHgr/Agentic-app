/**
 * Obrazovka Omalovánek s tlačítkem Zpět (#89 AC7) pro společná pravidla
 * rozložení (`tests/shared/layoutRules.ts`). Bere obrazovku z
 * `coloringLayoutScenes.ts` (plocha omalovánky, 8 barev, domeček) ve
 * stejných oknech a přidá ťukací plochu Zpět. Prvky jsou v CSS px okna.
 *
 * Navržené rozhraní `src/games/coloring/logic/coloringLayout.ts`:
 * `ColoringLayout.undoButton: LayoutRect` ťukací plocha tlačítka Zpět
 * v herních jednotkách, zatím zástupně u palety (konečné místo určí
 * úkol s gumou).
 */

import { layoutColoring } from '../../../src/games/coloring/logic/coloringLayout';
import { toCss } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS, boxOfRect, coloringCase } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

export const UNDO_NAME = 'Zpět';

export interface UndoCase extends ColoringCase {
  /** Ťukací plocha Zpět v CSS px okna. */
  readonly undo: Box;
}

/** Omalovánky s tlačítkem Zpět v okně `window` jako obrazovka pro pravidla. */
export function undoCase(window: TestWindow): UndoCase {
  const base = coloringCase(window);
  const undo = toCss(boxOfRect(layoutColoring(base.area).undoButton), base.area);
  return {
    ...base,
    undo,
    scene: {
      ...base.scene,
      label: `${base.scene.label} se Zpět`,
      items: [...base.scene.items, { name: UNDO_NAME, box: undo, tappable: true }],
    },
  };
}

export function undoCases(windows: readonly TestWindow[] = COLORING_WINDOWS): UndoCase[] {
  return windows.map(undoCase);
}
