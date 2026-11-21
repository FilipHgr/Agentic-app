import { describe, expect, it } from 'vitest';

import { createFlagLoads } from '../../src/menu/logic/flagLoads';

/**
 * Testy k #172 AC2: menu i výběr profilu chtějí vlajky jazyků zároveň,
 * ale každá vlajka se stáhne nejvýš jednou za život stránky.
 */

const CZECH = 'menuFlag:flag-czechia.svg';
const BRITISH = 'menuFlag:flag-united-kingdom.svg';

describe('načítání vlajek jazyků (#172)', () => {
  it('vlajku stáhne jen první scéna, druhá na ni počká', () => {
    const loads = createFlagLoads();
    expect(loads.decide(CZECH, false), 'menu žádá první').toBe('load');
    expect(loads.decide(CZECH, false), 'výběr profilu, zatímco se stahuje').toBe('wait');
  });

  it('už načtená vlajka se znovu nestahuje', () => {
    const loads = createFlagLoads();
    expect(loads.decide(CZECH, true)).toBe('loaded');
    expect(loads.decide(CZECH, true), 'po návratu ze hry').toBe('loaded');
  });

  it('každá vlajka se stahuje samostatně', () => {
    const loads = createFlagLoads();
    expect(loads.decide(CZECH, false)).toBe('load');
    expect(loads.decide(BRITISH, false), 'jiná vlajka').toBe('load');
  });

  it('vlajka, kterou se stáhnout nepodařilo, se znovu nestahuje', () => {
    const loads = createFlagLoads();
    loads.decide(CZECH, false);
    const decisions = [1, 2, 3].map(() => loads.decide(CZECH, false));
    expect(decisions, 'další scény po výpadku sítě').toEqual(['wait', 'wait', 'wait']);
  });
});
