import { describe, expect, it } from 'vitest';

import { SCENERY_TOP_SHARE } from '../../../src/games/counting/logic/mapScenery';
import { mapContentBox } from '../../../src/games/counting/logic/progressMapLayout';
import { MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import {
  KIND_NAMES,
  MAP_SCENERY_KINDS,
  MAP_WINDOWS,
  pieceName,
  piecesOf,
  sceneryCases,
} from './mapSceneryScenes';
import type { SceneryCase } from './mapSceneryScenes';

/**
 * Doplňující testy k #136 po kontrole UX: mráčky plují jen nahoře nad
 * cestou, nikdy dole na trávě, a v každém okně je stejně kousků každého
 * druhu, takže po otočení zařízení pokračují všechny (AC3). Každé
 * pravidlo projde v cyklu všechna okna mapy a 5 map.
 */

let cached: SceneryCase[] | undefined;

function cases(): SceneryCase[] {
  cached ??= sceneryCases();
  return cached;
}

describe('#136: mráček je ve vrchní části plochy mapy', () => {
  it('celá dráha mráčku leží v horních 40 % plochy mapy', () => {
    for (const testCase of cases()) {
      const content = mapContentBox(testCase.area);
      const topPartBottom = content.top + content.height * SCENERY_TOP_SHARE;
      for (const piece of piecesOf(testCase.scenery, 'cloud')) {
        expect(
          piece.sweep.bottom,
          `${testCase.label}: ${pieceName(testCase.scenery, piece)} je dole`,
        ).toBeLessThanOrEqual(topPartBottom + 1e-6);
      }
    }
  });
});

describe('#136 AC3: v každém okně se hýbe stejně kousků', () => {
  it('každá mapa má v každém okně stejný počet kousků každého druhu', () => {
    for (const theme of MAP_THEMES) {
      const ofTheme = cases().filter((testCase) => testCase.theme === theme);
      expect(ofTheme.length, `mapa ${theme}`).toBe(MAP_WINDOWS.length);
      const [first] = ofTheme;
      if (!first) {
        continue;
      }
      for (const testCase of ofTheme) {
        for (const kind of MAP_SCENERY_KINDS[theme]) {
          expect(
            piecesOf(testCase.scenery, kind).length,
            `${testCase.label}: ${KIND_NAMES[kind]} proti ${first.label}`,
          ).toBe(piecesOf(first.scenery, kind).length);
        }
      }
    }
  });
});
