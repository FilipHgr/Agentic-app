import { describe, expect, it } from 'vitest';

import { PREDICTION_STEP } from '../../../src/games/coloring/logic/colorLayerCode';
import { GRAIN_TILE_SIZE } from '../../../src/games/coloring/logic/crayonGrain';

describe('#93 AC6: uložené obrázky se čtou stejně i po změně zrna pastelky', () => {
  it('krok předpovědi záznamu p2 je pevný a dnes odpovídá výšce dlaždice zrna', () => {
    expect(PREDICTION_STEP.p2, 'změna zrna potřebuje novou verzi záznamu').toBe(GRAIN_TILE_SIZE);
    expect(PREDICTION_STEP.p2).toBe(16);
  });
});
