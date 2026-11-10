/**
 * Obrazovka Omalovánek s tlačítkem Zpět (#89 AC7, místo od #96 AC3) pro
 * společná pravidla rozložení (`tests/shared/layoutRules.ts`). Od #96 je
 * Zpět v pruhu ovládání u úchytu panelu, ne zástupně u palety; obrazovku
 * i se Zpět skládá `coloringLayoutScenes.ts`, ve všech oknech se zavřeným
 * i otevřeným panelem.
 *
 * Rozhraní: `ColoringLayout.undoButton: LayoutRect` ťukací plocha Zpět
 * v herních jednotkách (`coloringLayoutScenes.ts`).
 */

import { COLORING_WINDOWS, UNDO_NAME, coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import type { TestWindow } from '../../shared/viewportFixtures';

export { UNDO_NAME };

export type UndoCase = ColoringCase;

export function undoCases(windows: readonly TestWindow[] = COLORING_WINDOWS): UndoCase[] {
  return coloringCases(windows);
}
