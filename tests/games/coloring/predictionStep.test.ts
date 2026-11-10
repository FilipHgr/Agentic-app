import { describe, expect, it } from 'vitest';

import {
  CURRENT_LAYER_CODE,
  LAYER_COLOR_COUNT,
  PREDICTION_STEP,
  isP5GrainGap,
} from '../../../src/games/coloring/logic/colorLayerCode';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { GRAIN_TILE_SIZE, isGrainGap } from '../../../src/games/coloring/logic/crayonGrain';

describe('#93 AC6: uložené obrázky se čtou stejně i po změně zrna pastelky', () => {
  it('krok předpovědi záznamu p2 je pevný a dnes odpovídá výšce dlaždice zrna', () => {
    expect(PREDICTION_STEP.p2, 'změna zrna potřebuje novou verzi záznamu').toBe(GRAIN_TILE_SIZE);
    expect(PREDICTION_STEP.p2).toBe(16);
  });
});

describe('#100: barvy palety se do uloženého obrázku vždy vejdou', () => {
  // Od #115 zná ukládaná verze 64 barev, víc než dnešní paleta (rezerva pro sady barev nástrojů).
  it('ukládaná verze záznamu zná aspoň tolik barev, kolik má paleta', () => {
    expect(
      LAYER_COLOR_COUNT[CURRENT_LAYER_CODE],
      'víc barev v paletě potřebuje novou verzi záznamu, jinak by se obrázek uložil bez nich',
    ).toBeGreaterThanOrEqual(PALETTE.length);
  });
});

describe('#119: obrázky uložené formátem p5 se čtou stejně i po změně zrna pastelky', () => {
  it('zrno, podle kterého předpovídá formát p5, je pevné a dnes odpovídá zrnu pastelky', () => {
    const differences: string[] = [];
    for (let y = 0; y < 2 * GRAIN_TILE_SIZE; y += 1) {
      for (let x = 0; x < 2 * GRAIN_TILE_SIZE; x += 1) {
        if (isP5GrainGap(x, y) !== isGrainGap(x, y)) {
          differences.push(`(${x}, ${y})`);
        }
      }
    }
    expect(differences, 'změna zrna potřebuje novou verzi záznamu').toEqual([]);
  });
});
