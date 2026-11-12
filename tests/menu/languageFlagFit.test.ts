import { describe, expect, it } from 'vitest';

import { fitFlag, languageFlagOf, svgAspectRatio } from '../../src/menu/logic/languageFlags';

/**
 * #138 (kontrola UX): všechny vlajky jsou stejně vysoké jako rámeček,
 * bez deformace; širší vlajka se ořízne na šířku rámečku.
 */
describe('#138: vlajka vyplní výšku rámečku se zachovaným poměrem', () => {
  it('vlajka 3 : 2 vyplní rámeček 30 × 20 celý', () => {
    expect(fitFlag(30, 20, 3 / 2)).toEqual({
      left: 0,
      top: 0,
      width: 30,
      height: 20,
      drawnWidth: 30,
    });
  });

  it('vlajka 2 : 1 je stejně vysoká jako česká a kraje se oříznou na šířku rámečku', () => {
    expect(fitFlag(30, 20, 2)).toEqual({ left: 0, top: 0, width: 30, height: 20, drawnWidth: 40 });
  });

  it('na tlačítku v rámečku 24 × 16 je vlajka 2 : 1 také 24 × 16', () => {
    expect(fitFlag(24, 16, 2)).toEqual({ left: 0, top: 0, width: 24, height: 16, drawnWidth: 32 });
  });

  it('užší vlajka (1 : 1) vyplní výšku a je vodorovně uprostřed', () => {
    expect(fitFlag(30, 20, 1)).toEqual({ left: 5, top: 0, width: 20, height: 20, drawnWidth: 20 });
  });

  it('poměr stran se čte z viewBox, bez platného viewBox není žádný', () => {
    expect(svgAspectRatio('<svg viewBox="0 0 60 30"></svg>')).toBe(2);
    expect(svgAspectRatio('<svg></svg>')).toBeNull();
    expect(svgAspectRatio('<svg viewBox="0 0 0 30"></svg>')).toBeNull();
  });

  it('jazyk bez vlajky vlajku nemá', () => {
    expect(languageFlagOf('xx')).toBeNull();
    expect(languageFlagOf('en')?.file).toBe('flag-united-kingdom.svg');
  });
});
