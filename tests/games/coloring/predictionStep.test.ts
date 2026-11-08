import { describe, expect, it } from 'vitest';

import {
  CURRENT_LAYER_CODE,
  LAYER_COLOR_COUNT,
  PREDICTION_STEP,
} from '../../../src/games/coloring/logic/colorLayerCode';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { GRAIN_TILE_SIZE } from '../../../src/games/coloring/logic/crayonGrain';

describe('#93 AC6: uložené obrázky se čtou stejně i po změně zrna pastelky', () => {
  it('krok předpovědi záznamu p2 je pevný a dnes odpovídá výšce dlaždice zrna', () => {
    expect(PREDICTION_STEP.p2, 'změna zrna potřebuje novou verzi záznamu').toBe(GRAIN_TILE_SIZE);
    expect(PREDICTION_STEP.p2).toBe(16);
  });
});

describe('#100: barvy palety se do uloženého obrázku vždy vejdou', () => {
  it('ukládaná verze záznamu zná přesně tolik barev, kolik má paleta', () => {
    expect(
      LAYER_COLOR_COUNT[CURRENT_LAYER_CODE],
      'víc barev v paletě potřebuje novou verzi záznamu, jinak by se obrázek uložil bez nich',
    ).toBe(PALETTE.length);
  });
});
