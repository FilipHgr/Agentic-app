import { describe, expect, it } from 'vitest';

import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import type { Point } from './outlineFixtures';
import { at } from './strokeHelpers';
import {
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #89 (tlačítko Zpět vrátí poslední tah): AC1 přesné vrácení
 * a krátký tón, AC2 nejvýš 20 tahů, AC3 zhoupnutí, když není co vracet,
 * AC4 co do historie nepatří, AC5 barva zůstane, AC6 uložení a platnost
 * historie. Rozložení tlačítka (AC7) je v `undoLayoutRules.test.ts`,
 * rychlost ve WebKitu (AC8) je ruční kontrola.
 *
 * Ťuknutí na Zpět hlásí scéna logice jako `game.tapUndo()` nad otevřenou
 * omalovánkou (`openColoring`, #92). Odchod domečkem, schování stránky
 * i zavření panelu hlásí scéna jako `suspend()`; po odchodu domečkem
 * a obnovení stránky se omalovánka otevře znovu (`enterColoring`), a tím
 * historie zmizí. Schování stránky (přepnutí aplikace, zamčení) bez
 * odchodu z hry historii nechá (doporučení z komentáře k issue).
 *
 * Navržené rozhraní (`src/games/coloring/logic/savedPicture.ts`):
 * - `SavedColoring.tapUndo(): UndoResult`,
 * - `UndoResult` =
 *   `{ kind: 'undone'; changed: ChangedArea; tones: readonly Tone[] }`
 *   (obrázek se vrátil, scéna překreslí `changed` a zahraje tón),
 *   `| { kind: 'wobble'; tones: readonly Tone[] }` (není co vracet,
 *   tlačítko se jen zhoupne),
 *   `| { kind: 'ignored' }` (ťuknutí uprostřed tahu, nic se nestane).
 */

const RED = 0;
const ORANGE = 1;
const BLUE = 4;
const BLACK = 7;

/** Kdy dozní poslední tón, v sekundách od ťuknutí. */
function endOf(tones: readonly Tone[]): number {
  return Math.max(...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}

/** Vodorovný tah v řádku `row` (0 až 24) v levé oblasti, každý na jiném místě. */
function rowStroke(row: number): Point[] {
  const y = 4 + row * 8;
  return [at(10, y), at(140, y)];
}

describe('#89 AC1: Zpět vrátí obrázek přesně do stavu před posledním tahem', () => {
  it('po ťuknutí na Zpět je obrázek pixel po pixelu jako před posledním tahem', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    const beforeLast = pixelsOf(game, regions);
    game.tapColor(BLUE);
    paint(game, [at(170, 30), at(290, 170)]);

    const result = game.tapUndo();

    expect(result.kind).toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(beforeLast);
  });

  it('přebarvené místo dostane po Zpět zpátky svou původní barvu, nezůstane prázdné', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    game.tapColor(ORANGE);
    paint(game, [at(20, 100), at(130, 100)]);
    const orangeOnly = pixelsOf(game, regions);
    game.tapColor(BLUE);
    paint(game, [at(70, 60), at(70, 140)]);
    expect(game.colorAt(70, 100), 'přes oranžovou je modrá').toBe(BLUE);

    game.tapUndo();

    expect(game.colorAt(70, 100), 'místo křížení je zase oranžové').toBe(ORANGE);
    expect(pixelsOf(game, regions)).toEqual(orangeOnly);
  });

  it('po Zpět prvního tahu je obrázek zase celý prázdný', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(280, 100)]);

    game.tapUndo();

    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('po Zpět se ozve krátký tón, který dozní dřív než za 1 s', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(130, 100)]);

    const result = game.tapUndo();

    expect(result.kind).toBe('undone');
    const tones = result.kind === 'undone' ? result.tones : [];
    expect(tones.length, 'nějaký tón zazní').toBeGreaterThan(0);
    expect(endOf(tones), 'délka tónu v sekundách').toBeLessThan(1);
  });

  it('scéna dostane místo k překreslení, které obsahuje všechny vrácené pixely', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 20), at(280, 180)]);
    const before = pixelsOf(game, regions);

    const result = game.tapUndo();

    expect(result.kind).toBe('undone');
    if (result.kind !== 'undone') {
      return;
    }
    const after = pixelsOf(game, regions);
    const outside: string[] = [];
    after.forEach((color, index) => {
      if (color === before[index]) {
        return;
      }
      const x = index % regions.width;
      const y = Math.floor(index / regions.width);
      const { left, top, right, bottom } = result.changed;
      if (x < left || x >= right || y < top || y >= bottom) {
        outside.push(`${x}, ${y}`);
      }
    });
    expect(outside, 'vrácené pixely mimo místo k překreslení').toEqual([]);
  });
});

describe('#89 AC2: opakované Zpět vrací další tahy, nejvýš 20 posledních', () => {
  it('po 25 tazích jde vrátit 20 a obrázek zůstane ve stavu po 5. tahu', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    const afterStroke: Array<Array<number | null>> = [pixelsOf(game, regions)];
    for (let row = 0; row < 25; row += 1) {
      game.tapColor(row % 8);
      paint(game, rowStroke(row));
      afterStroke.push(pixelsOf(game, regions));
    }

    for (let undone = 1; undone <= 20; undone += 1) {
      expect(game.tapUndo().kind, `${undone}. ťuknutí na Zpět`).toBe('undone');
      expect(pixelsOf(game, regions), `po ${undone}. ťuknutí stav po ${25 - undone}. tahu`).toEqual(
        afterStroke[25 - undone],
      );
    }

    expect(game.tapUndo().kind, '21. ťuknutí už nic nevrátí').toBe('wobble');
    expect(pixelsOf(game, regions), 'obrázek zůstane ve stavu po 5. tahu').toEqual(afterStroke[5]);
  });

  it('po třech tazích vrátí tři ťuknutí všechny tři, jeden po druhém', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    const states = [pixelsOf(game, regions)];
    for (let row = 0; row < 3; row += 1) {
      paint(game, rowStroke(row * 5));
      states.push(pixelsOf(game, regions));
    }

    game.tapUndo();
    expect(pixelsOf(game, regions), 'po 1. ťuknutí').toEqual(states[2]);
    game.tapUndo();
    expect(pixelsOf(game, regions), 'po 2. ťuknutí').toEqual(states[1]);
    game.tapUndo();
    expect(pixelsOf(game, regions), 'po 3. ťuknutí').toEqual(states[0]);
  });

  it('po vrácení jde malovat dál a Zpět vrátí i nový tah', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    const afterFirst = pixelsOf(game, regions);
    paint(game, [at(20, 120), at(130, 120)]);
    game.tapUndo();

    game.tapColor(BLUE);
    paint(game, [at(200, 100), at(280, 100)]);
    expect(game.colorAt(240, 100), 'nový tah').toBe(BLUE);
    game.tapUndo();

    expect(pixelsOf(game, regions)).toEqual(afterFirst);
  });
});

describe('#89 AC3: když není co vracet, tlačítko se jen zhoupne a obrázek se nezmění', () => {
  it('Zpět hned po otevření prázdné omalovánky se jen zhoupne', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);

    expect(game.tapUndo().kind).toBe('wobble');
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('po vrácení všech tahů se další Zpět jen zhoupne a obrázek zůstane prázdný', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    paint(game, [at(170, 40), at(280, 40)]);
    game.tapUndo();
    game.tapUndo();

    expect(game.tapUndo().kind).toBe('wobble');
    expect(game.tapUndo().kind, 'ani opakované ťuknutí nic nerozbije').toBe('wobble');
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('po vrácení 20 tahů další Zpět obrázek nezmění, ani při dalších ťuknutích', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    for (let row = 0; row < 25; row += 1) {
      paint(game, rowStroke(row));
    }
    for (let undone = 0; undone < 20; undone += 1) {
      game.tapUndo();
    }
    const afterTwenty = pixelsOf(game, regions);

    for (let tap = 1; tap <= 3; tap += 1) {
      expect(game.tapUndo().kind, `${tap}. ťuknutí navíc`).toBe('wobble');
    }
    expect(pixelsOf(game, regions)).toEqual(afterTwenty);
  });

  it('rozmalovaný obrázek otevřený z úložiště nemá co vracet a zůstane stejný', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    paint(openOn(storage, regions), [at(20, 100), at(280, 100)]);
    const reopened = openOn(storage, regions);
    const saved = pixelsOf(reopened, regions);

    expect(reopened.tapUndo().kind).toBe('wobble');
    expect(pixelsOf(reopened, regions)).toEqual(saved);
  });
});

describe('#89 AC4: tah, který nic nezměnil, se do historie nepočítá', () => {
  it('po tahu začatém mimo plochu vrátí Zpět předchozí skutečný tah', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    const afterFirst = pixelsOf(game, regions);
    paint(game, [at(20, 120), at(130, 120)]);
    const afterSecond = pixelsOf(game, regions);
    paint(game, [at(-30, 80), at(100, 80), at(200, 80)]);
    expect(pixelsOf(game, regions), 'tah mimo plochu nic nenamaloval').toEqual(afterSecond);

    game.tapUndo();

    expect(pixelsOf(game, regions), 'vrátil se druhý tah').toEqual(afterFirst);
  });

  it('po tahu stejnou barvou přes už tak zabarvené místo vrátí Zpět předchozí skutečný tah', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    game.tapColor(RED);
    paint(game, [at(20, 100), at(130, 100)]);
    const afterRed = pixelsOf(game, regions);
    game.tapColor(BLUE);
    const bluePath = [at(170, 100), at(280, 100)];
    paint(game, bluePath);
    const afterBlue = pixelsOf(game, regions);
    paint(game, bluePath);
    paint(game, [at(200, 100), at(250, 100)]);
    expect(pixelsOf(game, regions), 'stejná barva přes stejné místo nic nezměnila').toEqual(
      afterBlue,
    );

    game.tapUndo();

    expect(pixelsOf(game, regions), 'vrátil se modrý tah').toEqual(afterRed);
  });

  it('po tahu po obrysu, který nevjel do žádné oblasti, vrátí Zpět předchozí skutečný tah', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(130, 100)]);
    paint(game, [at(150.5, 20), at(150.5, 180)]);

    game.tapUndo();

    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('jen tahy, které nic nezměnily, nedají co vracet: Zpět se zhoupne', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(-30, 80), at(-5, 120)]);
    paint(game, [at(150.5, 20), at(150.5, 180)]);

    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('tah stejnou barvou, který přesáhne na nezabarvené místo, se do historie počítá', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(80, 100)]);
    const afterShort = pixelsOf(game, regions);
    paint(game, [at(20, 100), at(130, 100)]);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(afterShort);
  });
});

describe('#89 AC4: ťuknutí na Zpět uprostřed tahu nic nezmění', () => {
  it('Zpět s prstem na ploše obrázek nezmění a nevrátí ani předchozí tah', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    startStroke(game, [at(20, 120), at(80, 120)]);
    const midStroke = pixelsOf(game, regions);

    const result = game.tapUndo();

    expect(result.kind, 'nic se nevrátilo').not.toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(midStroke);
  });

  it('tah po ťuknutí na Zpět pokračuje a po zvednutí prstu ho Zpět vrátí celý', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    const afterFirst = pixelsOf(game, regions);
    startStroke(game, [at(20, 120), at(60, 120)]);
    game.tapUndo();

    game.pointerMove({ id: 1, x: 130, y: 120, kind: 'touch' });
    expect(game.colorAt(120, 120), 'tah se dál maluje').toBe(RED);
    game.pointerUp(1);
    game.tapUndo();

    expect(pixelsOf(game, regions), 'vrátil se celý druhý tah').toEqual(afterFirst);
  });

  it('tah ukončený schováním stránky se počítá a Zpět ho vrátí', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    const afterFirst = pixelsOf(game, regions);
    startStroke(game, [at(20, 120), at(100, 120)]);
    game.suspend();

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(afterFirst);
  });
});

describe('#89 AC5: Zpět vrací jen obrázek, vybraná barva zůstane', () => {
  it('po Zpět zůstane vybraná barva, kterou dítě vybralo naposledy', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    game.tapColor(ORANGE);
    paint(game, [at(20, 100), at(130, 100)]);
    game.tapColor(BLUE);

    game.tapUndo();

    expect(game.palette().selected).toBe(BLUE);
    expect(paintedPixels(game, regions), 'oranžový tah se vrátil').toBe(0);
  });

  it('Zpět nevrací výběr barvy: bez dalšího tahu se jen zhoupne a barva zůstane', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    game.tapColor(BLUE);
    game.tapColor(BLACK);

    expect(game.tapUndo().kind).toBe('wobble');
    expect(game.palette().selected).toBe(BLACK);
  });

  it('po Zpět maluje další tah dál vybranou barvou', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    game.tapColor(ORANGE);
    paint(game, [at(20, 100), at(130, 100)]);
    game.tapColor(BLUE);
    game.tapUndo();

    paint(game, [at(200, 100), at(280, 100)]);

    expect(game.colorAt(240, 100)).toBe(BLUE);
  });
});

describe('#89 AC6: vrácený stav se uloží podle profilu stejně jako po tahu', () => {
  it('hned po Zpět je v úložišti obrázek po vrácení, bez čekání na odchod', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    paint(game, [at(20, 40), at(130, 40)]);
    paint(game, [at(170, 120), at(280, 120)]);
    game.tapUndo();
    // Žádné `suspend()`: panel se mohl hned zavřít.

    expect(pixelsOf(openOn(storage, regions), regions)).toEqual(pixelsOf(game, regions));
  });

  it('po Zpět a návratu domečkem do menu je obrázek ve stavu po vrácení a barva stejná', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    paint(game, [at(20, 40), at(130, 40)]);
    const afterFirst = pixelsOf(game, regions);
    game.tapColor(BLUE);
    paint(game, [at(170, 120), at(280, 120)]);
    game.tapUndo();
    game.suspend();

    const again = enterColoring(store, regions);
    expect(pixelsOf(again, regions)).toEqual(afterFirst);
    expect(again.palette().selected).toBe(BLUE);
  });

  it('vrácený stav se uloží jen do profilu, který maloval', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    secondGame.tapColor(BLUE);
    paint(secondGame, [at(20, 40), at(130, 40)]);
    const secondPicture = pixelsOf(secondGame, regions);
    secondGame.suspend();

    store.selectProfile(first.id);
    const game = enterColoring(store, regions);
    paint(game, [at(20, 40), at(130, 40)]);
    const afterFirst = pixelsOf(game, regions);
    paint(game, [at(170, 120), at(280, 120)]);
    game.tapUndo();
    game.suspend();

    expect(pixelsOf(enterColoring(store, regions), regions), 'obrázek prvního profilu').toEqual(
      afterFirst,
    );
    store.selectProfile(second.id);
    expect(pixelsOf(enterColoring(store, regions), regions), 'obrázek druhého profilu').toEqual(
      secondPicture,
    );
  });

  it('Zpět při plném úložišti obrázek vrátí a hra nespadne', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    paint(game, [at(20, 100), at(130, 100)]);
    storage.failWrites = true;

    expect(() => game.tapUndo()).not.toThrow();
    expect(paintedPixels(game, regions)).toBe(0);
  });
});

describe('#89 AC6: historie Zpět platí do odchodu z hry', () => {
  it('po schování stránky (přepnutí aplikace, zamčení) bez odchodu z hry Zpět dál vrací tahy', () => {
    const regions = twoHalves();
    const game = enterColoring(openProfiles(new DeviceStorage()), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    const afterFirst = pixelsOf(game, regions);
    paint(game, [at(170, 120), at(280, 120)]);
    game.suspend();

    expect(game.tapUndo().kind, 'po návratu na stránku').toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(afterFirst);
    game.tapUndo();
    expect(paintedPixels(game, regions), 'vrátil se i první tah').toBe(0);
  });

  it('po návratu z menu Zpět nic nevrátí a obrázek zůstane', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    paint(game, [at(20, 40), at(130, 40)]);
    paint(game, [at(170, 120), at(280, 120)]);
    const before = pixelsOf(game, regions);
    game.suspend();

    const again = enterColoring(store, regions);

    expect(again.tapUndo().kind).toBe('wobble');
    expect(pixelsOf(again, regions)).toEqual(before);
  });

  it('po obnovení stránky Zpět nic nevrátí a obrázek zůstane', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    paint(game, [at(20, 40), at(130, 40)]);
    paint(game, [at(170, 120), at(280, 120)]);
    const before = pixelsOf(game, regions);
    // Obnovení stránky: žádné `suspend()`, platí uložení po tahu.

    const reloaded = enterColoring(openProfiles(storage), regions);

    expect(reloaded.tapUndo().kind).toBe('wobble');
    expect(pixelsOf(reloaded, regions)).toEqual(before);
  });

  it('po návratu z menu jde malovat a Zpět vrátí jen nové tahy, ne ty z minula', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    paint(game, [at(20, 40), at(130, 40)]);
    game.suspend();
    const again = enterColoring(store, regions);
    const beforeNew = pixelsOf(again, regions);
    paint(again, [at(170, 120), at(280, 120)]);

    again.tapUndo();

    expect(pixelsOf(again, regions)).toEqual(beforeNew);
    expect(again.tapUndo().kind, 'starý tah z minula zůstane').toBe('wobble');
    expect(pixelsOf(again, regions)).toEqual(beforeNew);
  });
});
