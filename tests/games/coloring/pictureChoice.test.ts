import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { homeHoldDecision } from '../../../src/games/coloring/logic/pictureChoice';
import type { HomeHold, PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { createHoldButton } from '../../../src/shared/logic/holdButton';
import type { HoldButton } from '../../../src/shared/logic/holdButton';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import { startGameSession } from '../../../src/shared/ui/gameSession';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { at } from './strokeHelpers';
import {
  CIRCLES,
  HOUSE,
  ONLY_HOUSE,
  STAR,
  THREE_PICTURES,
  advancePickerClock,
  backToPicker,
  coloringStorage,
  enterPicker,
  openFromPicker,
} from './pictureChoiceHelpers';
import { paint, paintedPixels, pixelsOf, startStroke, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #124 AC1 (výběr při otevření), AC4 (návrat k výběru) a AC5
 * (okrajové případy ťuknutí a domečku). Výběr je čistá logika bez Phaseru
 * nad zadanou sadou omalovánek (doporučení reviewera): sada se zadává
 * v kódu, při 1 omalovánce se hra otevře rovnou v malování a domeček vrací
 * do menu, při 2 a více se ukáže výběr.
 *
 * Domeček drží stránka (`createHoldButton` jako v `attachHomeButton`)
 * a je vidět po celou dobu, i během otevírání omalovánky (rozhodnutí
 * koordinátora k AC5): ťuknutí ho vždy jen zhoupne. Po podržení 1 s se
 * stránka zeptá hry háčkem `host.onHomeHold` (sdílená část, testy
 * v `tests/shared/homeHold.test.ts`). Omalovánky odpoví podle výběru:
 * `homeHoldDecision(choice.holdHome())`. Podržení se počítá až od chvíle,
 * kdy je malování vidět: podržení dokončené dřív než 1 s po zobrazení
 * malování začalo ještě během otevírání, a nepočítá se vůbec (jako prst
 * držený při vypnutém `createHoldButton`). Výběr to pozná podle svých
 * hodin (`now`), testy domečku mu dávají falešné časovače Vitestu.
 *
 * Zhoupnutí náhledu a tón jsou vidět a slyšet ve scéně; logika vrací místo
 * náhledu a tóny k zahrání.
 */

/** Výběr s hodinami falešných časovačů (testy domečku). */
function timedPicker(pictures: readonly PictureIdentity[] = THREE_PICTURES): PictureChoice {
  return enterPicker(pictures, () => Date.now());
}

/** Výběr s otevřeným malováním náhledu `index` (s hodinami falešných časovačů). */
function paintingOf(index: number, pictures = THREE_PICTURES): PictureChoice {
  const choice = timedPicker(pictures);
  choice.tapPreview(index);
  choice.paintingShown();
  return choice;
}

/**
 * Omalovánky na stránce: hra ohlásí domeček (vidět je pořád) a napojí se
 * na podržení domečku. Zaznamená, co výběr odpověděl, kolikrát se domeček
 * zhoupl a jestli dítě odešlo do menu.
 */
interface TestHome {
  readonly button: HoldButton;
  readonly results: HomeHold[];
  readonly wobbles: () => number;
  readonly leftToMenu: () => boolean;
  readonly homeShown: () => boolean;
}

function homeFor(choice: PictureChoice): TestHome {
  const results: HomeHold[] = [];
  let wobbles = 0;
  let left = false;
  const homeButton = { hidden: true };
  const session = startGameSession({
    homeButton,
    startScenes: (running) => {
      running.host.setHomeAvailable(true);
      running.host.onHomeHold?.(() => {
        const result = choice.holdHome();
        results.push(result);
        return homeHoldDecision(result);
      });
      return () => undefined;
    },
    onLeft: () => {
      left = true;
    },
  });
  const button = createHoldButton({
    holdMs: HOLD_TO_GO_HOME_MS,
    isEnabled: () => session.isHomeEnabled(),
    onHoldComplete: () => session.holdHome(),
    onTap: () => {
      wobbles += 1;
    },
  });
  return {
    button,
    results,
    wobbles: () => wobbles,
    leftToMenu: () => left,
    homeShown: () => !homeButton.hidden,
  };
}

/** Dítě podrží domeček prstem `pointerId` celou 1 s a pustí. */
function holdFullSecond(home: TestHome, pointerId = 1): void {
  home.button.press(pointerId);
  vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
  home.button.release(pointerId);
}

/** Dítě na domeček jen krátce ťukne. */
function tapHome(home: TestHome, pointerId = 1): void {
  home.button.press(pointerId);
  vi.advanceTimersByTime(100);
  home.button.release(pointerId);
}

describe('#124 AC1: po otevření Omalovánek vidí dítě výběr omalovánek', () => {
  it('po ťuknutí na Omalovánky v menu je vidět výběr s náhledy všech omalovánek sady v jejím pořadí', () => {
    const choice = enterPicker(THREE_PICTURES);
    expect(choice.screen()).toEqual({ kind: 'picker' });
    expect(choice.previews()).toEqual(THREE_PICTURES);
  });

  it('sada ve hře má omalovánku domku s označením house verze 1 a 2 zástupné omalovánky', () => {
    expect(COLORING_PICTURES.length, 'domek a 2 zástupné omalovánky').toBe(3);
    expect(COLORING_PICTURES[0], 'domek je první').toEqual(HOUSE);
    const ids = COLORING_PICTURES.map((picture) => picture.id);
    expect(new Set(ids).size, 'každá omalovánka má vlastní označení').toBe(ids.length);
  });

  it('se sadou ve hře se při otevření ukáže výběr', () => {
    expect(enterPicker(COLORING_PICTURES).screen()).toEqual({ kind: 'picker' });
  });

  it('pořadí náhledů je stálé: po každém otevření a i po malování je stejné', () => {
    const storage = coloringStorage(openProfiles(new DeviceStorage()));
    const regions = twoHalves();
    const first = enterPicker(THREE_PICTURES);
    const order = first.previews();

    const game = openFromPicker(first, 2, storage, regions);
    paint(game, [at(20, 100), at(140, 100)]);
    backToPicker(first, game);
    expect(first.previews(), 'po návratu z malování').toEqual(order);

    for (let opening = 0; opening < 3; opening += 1) {
      expect(enterPicker(THREE_PICTURES).previews(), `otevření ${opening + 1}`).toEqual(order);
    }
  });

  it('ťuknutí na náhled hned zahraje tón, náhled se zhoupne a otevře se malování té omalovánky', () => {
    THREE_PICTURES.forEach((picture, index) => {
      const choice = enterPicker(THREE_PICTURES);
      const tap = choice.tapPreview(index);
      expect(tap, `náhled ${index + 1}`).toMatchObject({ kind: 'open', index, picture });
      expect(
        tap.kind === 'open' ? tap.tones.length : 0,
        `tón náhledu ${index + 1}`,
      ).toBeGreaterThan(0);
      expect(choice.screen(), `otevírá se omalovánka ${index + 1}`).toEqual({
        kind: 'opening',
        picture,
      });
      choice.paintingShown();
      expect(choice.screen(), `malování omalovánky ${index + 1}`).toEqual({
        kind: 'painting',
        picture,
      });
    });
  });
});

describe('#124 (doporučení reviewera): sada s jedinou omalovánkou', () => {
  it('při 1 omalovánce se hra otevře rovnou v malování bez výběru', () => {
    const choice = enterPicker(ONLY_HOUSE);
    expect(choice.screen(), 'otevírá se jediná omalovánka').toEqual({
      kind: 'opening',
      picture: HOUSE,
    });
    choice.paintingShown();
    expect(choice.screen()).toEqual({ kind: 'painting', picture: HOUSE });
  });

  it('při 1 omalovánce vrací domeček podržený v malování rovnou do menu', () => {
    const choice = enterPicker(ONLY_HOUSE);
    choice.paintingShown();
    advancePickerClock(HOLD_TO_GO_HOME_MS);
    expect(choice.holdHome()).toBe('toMenu');
    expect(homeHoldDecision('toMenu'), 'stránka odejde do menu').toBe('leave');
  });

  it('při 2 omalovánkách se ukáže výběr', () => {
    expect(enterPicker([HOUSE, STAR]).screen()).toEqual({ kind: 'picker' });
    expect(enterPicker([HOUSE, STAR]).previews()).toEqual([HOUSE, STAR]);
  });
});

describe('#124 AC4: návrat k výběru domečkem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('domeček v malování podržený 1 s vrátí dítě na výběr a ne do menu', () => {
    const choice = paintingOf(1);
    const home = homeFor(choice);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    holdFullSecond(home);
    expect(home.results).toEqual(['toPicker']);
    expect(home.leftToMenu(), 'dítě zůstalo v Omalovánkách').toBe(false);
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('po návratu na výběr jde otevřít jinou omalovánku', () => {
    const choice = paintingOf(0);
    holdFullSecond(homeFor(choice));
    expect(choice.tapPreview(2)).toMatchObject({ kind: 'open', picture: STAR });
  });

  it('podržení domečku uloží obrázek: rozpracovaný tah se uloží až do místa, kam prst došel', () => {
    vi.useRealTimers();
    const storage = coloringStorage(openProfiles(new DeviceStorage()));
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);
    const game = openFromPicker(choice, 1, storage, regions);
    startStroke(game, [at(20, 100), at(140, 100)]);
    const before = pixelsOf(game, regions);
    // Scéna při návratu na výběr obrázek uloží jako při odchodu (#92 AC3).
    backToPicker(choice, game);

    const again = openFromPicker(choice, 1, storage, regions);
    expect(paintedPixels(again, regions), 'tah se uložil').toBeGreaterThan(0);
    expect(pixelsOf(again, regions), 'až do místa, kam prst došel').toEqual(before);
  });

  it('domeček na výběru podržený 1 s vrátí dítě do menu', () => {
    const choice = timedPicker(THREE_PICTURES);
    const home = homeFor(choice);
    holdFullSecond(home);
    expect(home.results).toEqual(['toMenu']);
    expect(home.leftToMenu()).toBe(true);
  });

  it('domeček na výběru po návratu z malování podržený 1 s vrátí dítě do menu', () => {
    const choice = paintingOf(0);
    const home = homeFor(choice);
    holdFullSecond(home);
    expect(home.leftToMenu(), 'po prvním podržení na výběru').toBe(false);
    holdFullSecond(home);
    expect(home.results).toEqual(['toPicker', 'toMenu']);
    expect(home.leftToMenu(), 'po druhém podržení').toBe(true);
  });

  it('ťuknutí na domeček na výběru ho jen zhoupne a dítě zůstane na výběru', () => {
    const choice = timedPicker(THREE_PICTURES);
    const home = homeFor(choice);
    tapHome(home);
    expect(home.wobbles(), 'zhoupnutí').toBe(1);
    expect(home.results, 'výběr se neptá').toEqual([]);
    expect(home.leftToMenu()).toBe(false);
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('ťuknutí na domeček v malování ho jen zhoupne a dítě zůstane v malování', () => {
    const choice = paintingOf(2);
    const home = homeFor(choice);
    tapHome(home);
    expect(home.wobbles(), 'zhoupnutí').toBe(1);
    expect(home.results, 'výběr se neptá').toEqual([]);
    expect(choice.screen()).toEqual({ kind: 'painting', picture: STAR });
  });

  it('domeček podržený kratší dobu než 1 s dítě nikam nevede', () => {
    const choice = paintingOf(0);
    const home = homeFor(choice);
    home.button.press(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS - 1);
    home.button.release(1);
    expect(home.results).toEqual([]);
    expect(choice.screen()).toEqual({ kind: 'painting', picture: HOUSE });
  });

  it('návrat na výběr a odchod do menu stránka pozná: na výběr „zůstat“, do menu „odejít“', () => {
    expect(homeHoldDecision('toPicker')).toBe('stay');
    expect(homeHoldDecision('toMenu')).toBe('leave');
    expect(homeHoldDecision('ignored')).toBe('stay');
  });
});

describe('#124 AC5: okrajové případy výběru', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ťuknutí na místo bez omalovánky (prázdná místa se neukazují) nic neudělá', () => {
    const choice = enterPicker(THREE_PICTURES);
    for (const index of [3, 4, 5, -1, 1.5, Number.NaN]) {
      expect(choice.tapPreview(index), `místo ${String(index)}`).toEqual({ kind: 'ignored' });
      expect(choice.screen(), `místo ${String(index)}`).toEqual({ kind: 'picker' });
    }
  });

  it('dva prsty na dvou náhledech otevřou jen první omalovánku a jen jednou', () => {
    const choice = enterPicker(THREE_PICTURES);
    const first = choice.tapPreview(0);
    const second = choice.tapPreview(1);
    expect(first).toMatchObject({ kind: 'open', picture: HOUSE });
    expect(second, 'druhý prst').toEqual({ kind: 'ignored' });
    choice.paintingShown();
    expect(choice.screen()).toEqual({ kind: 'painting', picture: HOUSE });
  });

  it('rychlé dvojí ťuknutí na náhled otevře omalovánku jen jednou', () => {
    const choice = enterPicker(THREE_PICTURES);
    const taps = [choice.tapPreview(1), choice.tapPreview(1)];
    expect(taps.filter((tap) => tap.kind === 'open')).toHaveLength(1);
    expect(choice.screen()).toEqual({ kind: 'opening', picture: CIRCLES });
  });

  it('ťuknutí na náhled, když je malování už vidět, nic neotevře', () => {
    const choice = paintingOf(0);
    expect(choice.tapPreview(1)).toEqual({ kind: 'ignored' });
    expect(choice.screen()).toEqual({ kind: 'painting', picture: HOUSE });
  });

  it('během otevírání omalovánky zůstane domeček vidět', () => {
    const choice = timedPicker(THREE_PICTURES);
    const home = homeFor(choice);
    choice.tapPreview(1);
    expect(home.homeShown()).toBe(true);
  });

  it('domeček ťuknutý během otevírání se jen zhoupne, otevírání se dokončí a dítě zůstane v malování', () => {
    const choice = timedPicker(THREE_PICTURES);
    const home = homeFor(choice);
    choice.tapPreview(1);
    tapHome(home);
    expect(home.wobbles(), 'zhoupnutí').toBe(1);
    choice.paintingShown();
    expect(home.results).toEqual([]);
    expect(choice.screen()).toEqual({ kind: 'painting', picture: CIRCLES });
  });

  it('domeček podržený celou 1 s během otevírání: otevírání se dokončí a dítě zůstane v malování', () => {
    const choice = timedPicker(THREE_PICTURES);
    const home = homeFor(choice);
    choice.tapPreview(2);
    holdFullSecond(home);
    expect(home.results, 'podržení během otevírání se nepočítá').toEqual(['ignored']);
    expect(home.leftToMenu(), 'ani do menu').toBe(false);
    choice.paintingShown();
    expect(choice.screen()).toEqual({ kind: 'painting', picture: STAR });
  });

  it('prst držený na domečku z doby otevírání se nepočítá vůbec, ani když drží dál', () => {
    const choice = timedPicker(THREE_PICTURES);
    const home = homeFor(choice);
    choice.tapPreview(0);
    home.button.press(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS / 2);
    choice.paintingShown();
    // Prst drží dál: 1 s od dotyku doběhne v malování a pak ještě dlouho po ní.
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS * 3);
    home.button.release(1);
    expect(
      home.results.filter((result) => result === 'toPicker'),
      'nevrátí na výběr',
    ).toEqual([]);
    expect(home.leftToMenu(), 'ani do menu').toBe(false);
    expect(choice.screen()).toEqual({ kind: 'painting', picture: HOUSE });
  });

  it('podržení začaté, až je malování vidět, se počítá a vrátí dítě na výběr', () => {
    const choice = timedPicker(THREE_PICTURES);
    const home = homeFor(choice);
    choice.tapPreview(0);
    vi.advanceTimersByTime(300);
    choice.paintingShown();
    holdFullSecond(home);
    expect(home.results).toEqual(['toPicker']);
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('jediná omalovánka: podržení z doby otevírání se nepočítá, nové podržení vrátí do menu', () => {
    const choice = timedPicker(ONLY_HOUSE);
    const home = homeFor(choice);
    home.button.press(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS / 2);
    choice.paintingShown();
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    home.button.release(1);
    expect(home.leftToMenu(), 'podržení z doby otevírání').toBe(false);

    holdFullSecond(home, 2);
    expect(home.leftToMenu(), 'nové podržení').toBe(true);
  });
});
