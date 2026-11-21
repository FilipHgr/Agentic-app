import { describe, expect, it } from 'vitest';

import { RUDY_CARD_STYLE } from '../../src/shared/logic/rudyCard';
import { PAGE_BUTTON_DIM_FILTER, dimPageButtons } from '../../src/shared/logic/rudyPageButtons';

/**
 * Testy k #170: během okna s Rudym jsou domeček a kolečko nastavení
 * ztmavené jako hra pod kartou a po zavření okna mají zpátky původní
 * `filter`. Tlačítka stránky jsou tu jednoduché objekty se stylem.
 */

function button(filter = ''): { style: { filter: string } } {
  return { style: { filter } };
}

describe('#170: domeček a kolečko během okna s Rudym', () => {
  it('ztmavení tlačítek je stejné jako ztmavení hry pod kartou', () => {
    expect(PAGE_BUTTON_DIM_FILTER).toBe(`brightness(${1 - RUDY_CARD_STYLE.dimAlpha})`);
  });

  it('během okna jsou domeček i kolečko ztmavené', () => {
    const home = button();
    const gear = button();
    dimPageButtons([home, gear]);
    expect(home.style.filter).toBe(PAGE_BUTTON_DIM_FILTER);
    expect(gear.style.filter).toBe(PAGE_BUTTON_DIM_FILTER);
  });

  it('po zavření okna mají domeček a kolečko zpátky původní filter', () => {
    const home = button();
    const gear = button('drop-shadow(0 0 2px red)');
    const restore = dimPageButtons([home, gear]);
    restore();
    expect(home.style.filter).toBe('');
    expect(gear.style.filter).toBe('drop-shadow(0 0 2px red)');
  });

  it('druhé vrácení nepřepíše filter, který mezitím nastavil někdo jiný', () => {
    const home = button();
    const restore = dimPageButtons([home]);
    restore();
    home.style.filter = 'grayscale(1)';
    restore();
    expect(home.style.filter).toBe('grayscale(1)');
  });

  it('chybějící tlačítko (menu bez domečku) se přeskočí', () => {
    const gear = button();
    const restore = dimPageButtons([null, gear]);
    expect(gear.style.filter).toBe(PAGE_BUTTON_DIM_FILTER);
    restore();
    expect(gear.style.filter).toBe('');
  });
});
