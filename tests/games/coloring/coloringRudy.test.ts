import { describe, expect, it } from 'vitest';

import {
  RUDY_PRAISE_INTERVAL_MS,
  createColoringRudy,
  trackCameraPraise,
} from '../../../src/games/coloring/logic/coloringRudy';
import type { ColoringRudy } from '../../../src/games/coloring/logic/coloringRudy';

/**
 * Testy k #175 AC1, AC2 a AC4: kdy panda Rudy v Omalovánkách pozdraví
 * a kdy pochválí obrázek uložený do alba. Okno, stažení a hlas hlídají
 * testy sdíleného `RudyMoments` (#170, #171); tady jen rozhodnutí hry.
 */

const MINUTE = 60 * 1000;

/** Ukáže a zavře okno chvíle, o kterou hra právě požádala. */
function showAndClose(rudy: ColoringRudy, now: number): void {
  rudy.opened(now);
  rudy.closed();
}

/** Cvak a uložení v čase `now` bez dotyku: vrátí repliku pochvaly, pokud okno přijde (a ukáže se). */
function saveToAlbum(rudy: ColoringRudy, now: number): string | null {
  const moment = rudy.reservePraise(now);
  if (moment === null) {
    return null;
  }
  showAndClose(rudy, now);
  return moment.line;
}

describe('#175 AC1: pozdrav po otevření Omalovánek', () => {
  it('po otevření Omalovánek Rudy pozdraví mávnutím a replikou pozdravu', () => {
    const rudy = createColoringRudy();
    expect(rudy.greeting()).toEqual({ kind: 'greeting', move: 'wave', line: 'greeting' });
  });

  it('pozdrav přijde jen jednou, ani po návratu z malování na výběr se neopakuje', () => {
    const rudy = createColoringRudy();
    expect(rudy.greeting()).not.toBeNull();
    showAndClose(rudy, 0);
    expect(rudy.greeting()).toBeNull();
  });

  it('když dítě začne vybírat dřív, než se okno stáhne, pozdrav se vynechá a už nepřijde', () => {
    const rudy = createColoringRudy();
    rudy.greeting();
    expect(rudy.childActed()).toBe(true);
    expect(rudy.greeting()).toBeNull();
  });

  it('během otevřeného okna dotyk okno nezavře ani nevynechá (okno dotyky pohltí samo)', () => {
    const rudy = createColoringRudy();
    rudy.greeting();
    rudy.opened(0);
    expect(rudy.childActed()).toBe(false);
    // Okno je pořád otevřené: pochvala se přes něj nezarezervuje.
    expect(rudy.reservePraise(0)).toBeNull();
  });

  it('dotyk bez čekající chvíle nic nevynechá', () => {
    const rudy = createColoringRudy();
    expect(rudy.childActed()).toBe(false);
  });
});

describe('#175 AC2: pochvala obrázku v albu', () => {
  it('po prvním uložení do alba Rudy oslavuje a chválí obrázek', () => {
    const rudy = createColoringRudy();
    expect(rudy.reservePraise(0)).toEqual({
      kind: 'praise',
      move: 'celebrate',
      line: 'praiseBeautiful',
    });
  });

  it('pochvaly se střídají: krásný obrázek, krásné barvičky, zase krásný obrázek', () => {
    const rudy = createColoringRudy();
    const lines = [0, 1, 2].map((index) => saveToAlbum(rudy, index * RUDY_PRAISE_INTERVAL_MS));
    expect(lines).toEqual(['praiseBeautiful', 'praiseColors', 'praiseBeautiful']);
  });

  it('další uložení dřív než za 2 minuty od pochvaly projde bez Rudyho', () => {
    const rudy = createColoringRudy();
    expect(saveToAlbum(rudy, 10 * MINUTE)).not.toBeNull();
    expect(saveToAlbum(rudy, 10 * MINUTE + 1)).toBeNull();
    expect(saveToAlbum(rudy, 11 * MINUTE)).toBeNull();
    expect(saveToAlbum(rudy, 12 * MINUTE - 1)).toBeNull();
  });

  it('po 2 minutách od pochvaly Rudy pochválí další obrázek', () => {
    const rudy = createColoringRudy();
    saveToAlbum(rudy, 10 * MINUTE);
    expect(saveToAlbum(rudy, 12 * MINUTE)).toBe('praiseColors');
  });

  it('2 minuty se počítají od ukázání okna, ne od požádání', () => {
    const rudy = createColoringRudy();
    rudy.reservePraise(0);
    rudy.opened(MINUTE);
    rudy.closed();
    expect(rudy.reservePraise(2 * MINUTE + 30 * 1000)).toBeNull();
    expect(rudy.reservePraise(3 * MINUTE)).not.toBeNull();
  });

  it('hodiny jdoucí pozpátku pochvalu nepovolí', () => {
    const rudy = createColoringRudy();
    saveToAlbum(rudy, 10 * MINUTE);
    expect(rudy.reservePraise(MINUTE)).toBeNull();
    expect(rudy.reservePraise(Number.NaN)).toBeNull();
  });

  it('když dítě maluje dřív, než se okno stáhne, pochvala se vynechá a limit se nepočítá', () => {
    const rudy = createColoringRudy();
    expect(rudy.reservePraise(0)?.line).toBe('praiseBeautiful');
    expect(rudy.childActed()).toBe(true);
    // Hned další uložení: vynechaná pochvala se nepočítala, přijde tatáž.
    expect(rudy.reservePraise(1000)?.line).toBe('praiseBeautiful');
  });

  it('když dítě po cvaku hned maluje, pochvala se vynechá', () => {
    const rudy = createColoringRudy();
    // Cvak: pochvala se zarezervuje a čeká na uložení a odlet fotky.
    const praise = rudy.reservePraise(0);
    expect(praise).not.toBeNull();
    // Dítě maluje dál dřív, než se uložení a animace dokončí.
    expect(rudy.childActed()).toBe(true);
    // Uložení a animace doběhly: zarezervovaná pochvala už nečeká, okno nepřijde.
    expect(praise !== null && rudy.isWaiting(praise)).toBe(false);
    // Limit 2 minut se nezapočítal: další uložení hned pochválí tatáž replika.
    expect(rudy.reservePraise(1000)?.line).toBe('praiseBeautiful');
  });

  it('bez dotyku po cvaku zarezervovaná pochvala po uložení a animaci přijde', () => {
    const rudy = createColoringRudy();
    const praise = rudy.reservePraise(0);
    expect(praise !== null && rudy.isWaiting(praise)).toBe(true);
  });

  it('když se obrázek neuloží, zarezervovaná pochvala nepřijde a limit se nezapočítá', () => {
    const rudy = createColoringRudy();
    const praise = rudy.reservePraise(0);
    if (praise !== null) {
      rudy.withdraw(praise);
    }
    expect(praise !== null && rudy.isWaiting(praise)).toBe(false);
    expect(rudy.reservePraise(1000)?.line).toBe('praiseBeautiful');
  });

  it('během čekající nebo otevřené pochvaly další uložení o okno nepožádá', () => {
    const rudy = createColoringRudy();
    expect(rudy.reservePraise(0)).not.toBeNull();
    expect(rudy.reservePraise(0)).toBeNull();
    rudy.opened(0);
    expect(rudy.reservePraise(5 * MINUTE)).toBeNull();
  });

  it('pozdrav čekající na stažení pochvalu nezdvojí a pochvala až po něm', () => {
    const rudy = createColoringRudy();
    rudy.greeting();
    expect(rudy.reservePraise(0)).toBeNull();
    rudy.closed();
    expect(rudy.reservePraise(0)).not.toBeNull();
  });

  it('pozdrav se do limitu 2 minut pochvaly nepočítá', () => {
    const rudy = createColoringRudy();
    rudy.greeting();
    showAndClose(rudy, 0);
    expect(rudy.reservePraise(1000)).not.toBeNull();
  });

  it('pochvala, která by přišla, se dá stáhnout dopředu a nic se tím nezmění', () => {
    const rudy = createColoringRudy();
    expect(rudy.upcomingPraise(0)?.line).toBe('praiseBeautiful');
    expect(rudy.upcomingPraise(0)?.line).toBe('praiseBeautiful');
    saveToAlbum(rudy, 0);
    expect(rudy.upcomingPraise(MINUTE)).toBeNull();
    expect(rudy.upcomingPraise(2 * MINUTE)?.line).toBe('praiseColors');
  });
});

describe('#175 AC4: hra se nikdy nezdrží', () => {
  it('nestažené okno (vynechaná chvíle) další pochvalu nezablokuje', () => {
    const rudy = createColoringRudy();
    rudy.reservePraise(0);
    // Okno se nestáhlo včas: RudyMoments ohlásí zavření bez ukázání.
    rudy.closed();
    expect(rudy.reservePraise(1000)?.line).toBe('praiseBeautiful');
  });

  it('konec malování během čekání chvíli zapomene a další malování může pochválit', () => {
    const rudy = createColoringRudy();
    rudy.reservePraise(0);
    rudy.cancel();
    expect(rudy.reservePraise(1000)).not.toBeNull();
  });

  it('konec malování s otevřeným oknem okno zapomene, limit 2 minut platí dál', () => {
    const rudy = createColoringRudy();
    rudy.reservePraise(0);
    rudy.opened(0);
    rudy.cancel();
    expect(rudy.reservePraise(MINUTE)).toBeNull();
    expect(rudy.reservePraise(2 * MINUTE)).not.toBeNull();
  });
});

describe('#175 AC2: pochvala až po uložení a doběhnutí animace fotky', () => {
  /** Cvak: zarezervuje pochvalu a začne sledovat uložení a animaci. */
  function click(rudy: ColoringRudy) {
    const praise = rudy.reservePraise(0);
    if (praise === null) {
      throw new Error('pochvala se nezarezervovala');
    }
    return trackCameraPraise(rudy, praise);
  }

  it('okno přijde, až se obrázek uloží a fotka doletí (nejdřív uložení)', () => {
    const tracker = click(createColoringRudy());
    expect(tracker.saveFinished(true)).toBe('wait');
    expect(tracker.photoEnded()).toBe('show');
  });

  it('okno přijde, až se obrázek uloží a fotka doletí (nejdřív odlet)', () => {
    const tracker = click(createColoringRudy());
    expect(tracker.photoEnded()).toBe('wait');
    expect(tracker.saveFinished(true)).toBe('show');
  });

  it('když se obrázek neuloží, Rudy nepřijde a limit 2 minut se nezapočítá', () => {
    const rudy = createColoringRudy();
    const tracker = click(rudy);
    expect(tracker.photoEnded()).toBe('wait');
    expect(tracker.saveFinished(false)).toBe('skip');
    expect(rudy.reservePraise(1000)?.line).toBe('praiseBeautiful');
  });

  it('když dítě po cvaku hned maluje, pochvala se vynechá i po uložení a odletu fotky', () => {
    const rudy = createColoringRudy();
    const tracker = click(rudy);
    rudy.childActed();
    expect(tracker.saveFinished(true)).toBe('skip');
    expect(tracker.photoEnded()).toBe('skip');
  });

  it('dotyk mezi uložením a doletem fotky pochvalu taky vynechá', () => {
    const rudy = createColoringRudy();
    const tracker = click(rudy);
    expect(tracker.saveFinished(true)).toBe('wait');
    rudy.childActed();
    expect(tracker.photoEnded()).toBe('skip');
  });

  it('okno se ukáže jen jednou, i když animace ohlásí konec znovu', () => {
    const tracker = click(createColoringRudy());
    tracker.saveFinished(true);
    expect(tracker.photoEnded()).toBe('show');
    expect(tracker.photoEnded()).toBe('skip');
  });
});
