import { afterEach, describe, expect, it, vi } from 'vitest';

import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { settle } from './albumHelpers';
import {
  CIRCLES,
  EMA,
  HOUSE,
  P_COLOR,
  albumAfter,
  albumPixels,
  choiceOn,
  pageOf,
  prepareSwap,
  reloadAndOpen,
  sameImage,
  settleOn,
  showPainting,
  timesIn,
  wholeState,
  writesOfWholeSwap,
} from './continuePaintingHelpers';
import type { PreparedSwap, SwapScenario } from './continuePaintingHelpers';
import { pixelsOf } from './savedPictureHelpers';

/**
 * Testy k #131 AC5 (obnovení stránky v kterémkoli okamžiku výměny).
 * Označení podle issue: P je rozmalovaná stránka omalovánky před
 * ťuknutím, A obrázek z alba.
 *
 * Výměna se přeruší po každém zápisu do úložiště (`localStorage` i album
 * v IndexedDB): zkušební zařízení po zadaném počtu zápisů „vypne
 * stránku“, nic dalšího se nezapíše a rozběhnuté operace alba nikdy
 * neskončí (`SwapDevice.cutAfterWrites`). Tím se pokryjí všechna místa
 * přerušení z tabulky v issue (před 1, po 1 až po 5) bez znalosti toho,
 * jak výměna kroky dělá: kroky v poznámce pro implementaci jsou nezávazné.
 * Počet zápisů celé výměny testy změří na stejném scénáři bez přerušení.
 *
 * Po obnovení stránky se otevřou Omalovánky: `settleAlbumSwap` dokončí
 * nebo vrátí odloženou výměnu (pravidlo po obnovení z poznámky v issue).
 * Podle doporučení story-reviewer platí: stav je celý před výměnou, po ní,
 * nebo stav z AC4 (stránka A, P odložená a doplní se při dalším otevření).
 * Se zařízením, které po obnovení funguje, se stav z AC4 hned dokončí,
 * takže po otevření Omalovánek je stav vždy celý před, nebo po.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Kolikrát se nanejvýš přeruší i samotné dokončení nebo vrácení po obnovení. */
const SETTLE_CUTS = 4;

/** Přeruší výměnu po `cut` zápisech: dítě ťukne na štětec a stránka pak přestane žít. */
async function interruptedSwap(scenario: SwapScenario, cut: number): Promise<PreparedSwap> {
  const prepared = await prepareSwap(scenario);
  prepared.device.cutAfterWrites(cut);
  const tap = prepared.page.choice.tapContinue();
  expect(tap.kind, `přerušení po ${cut}. zápisu: štětec výměnu začne`).toBe('swapping');
  await settle();
  return prepared;
}

/** Místa přerušení 0 až počet zápisů celé výměny (poslední = výměna doběhla). */
async function cutsOf(scenario: SwapScenario): Promise<number[]> {
  const total = await writesOfWholeSwap(scenario);
  expect(total, 'výměna zapíše aspoň stránku, smazání A a uložení P').toBeGreaterThanOrEqual(3);
  return Array.from({ length: total + 1 }, (_, cut) => cut);
}

/** Je obrázek P po otevření Omalovánek na stránce, nebo v albu? */
function pIsKept(
  page: ReadonlyArray<number | null>,
  album: ReadonlyArray<Array<number | null>>,
  p: Array<number | null>,
): boolean {
  return sameImage([...page], p) || timesIn(album, p) === 1;
}

describe('#131 AC5: po obnovení stránky v kterémkoli okamžiku výměny', () => {
  it('stav je po otevření Omalovánek vždy celý před výměnou, nebo po ní, nikdy napůl', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 1 };
    const cuts = await cutsOf(scenario);
    const states: string[] = [];

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      await reloadAndOpen(prepared.device);
      const state = await wholeState(prepared, true);
      states.push(state);
      expect(state, `přerušení po ${cut}. zápisu z ${cuts.length - 1}`).not.toBe('napůl');
    }
    expect(states[0], 'přerušení před prvním zápisem: stav před').toBe('před');
    expect(states.at(-1), 'výměna doběhla: stav po').toBe('po');
  });

  it('s čistou stránkou je stav po otevření vždy celý před výměnou, nebo po ní', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 0, page: 'clean' };
    const cuts = await cutsOf({ ...scenario });

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      await reloadAndOpen(prepared.device);
      expect(await wholeState(prepared, false), `přerušení po ${cut}. zápisu`).not.toBe('napůl');
    }
  });

  it('P se nikdy neztratí, A není nikdy dvakrát a nikdy nechybí P i A zároveň', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 2 };
    const cuts = await cutsOf(scenario);

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      await reloadAndOpen(prepared.device);
      const page = pageOf(prepared.device);
      const album = await albumPixels(prepared.device);
      const what = `přerušení po ${cut}. zápisu`;
      const aCount = timesIn(album, prepared.a) + (sameImage(page, prepared.a) ? 1 : 0);
      expect(pIsKept(page, album, prepared.p), `${what}: P je na stránce, nebo v albu`).toBe(true);
      expect(timesIn(album, prepared.p), `${what}: P v albu nejvýš jednou`).toBeLessThanOrEqual(1);
      expect(aCount, `${what}: A je na stránce, nebo v albu, právě jednou`).toBe(1);
    }
  });

  it('ostatní obrázky alba, nečitelné záznamy a stránka jiné omalovánky se nezmění', async () => {
    const scenario: SwapScenario = { albumCount: 4, aIndex: 1, unreadable: 2, otherPage: true };
    const cuts = await cutsOf(scenario);

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      const unreadable = structuredClone(
        prepared.device.shelf.records.filter((record) => !('layerCode' in record.data)),
      );
      await reloadAndOpen(prepared.device);
      const what = `přerušení po ${cut}. zápisu`;
      const others = albumAfter(prepared, false);
      const album = (await albumPixels(prepared.device)).filter(
        (pixels) => !sameImage(pixels, prepared.a) && !sameImage(pixels, prepared.p),
      );
      expect(album, `${what}: ostatní obrázky v původním pořadí`).toEqual(others);
      expect(
        prepared.device.shelf.records.filter((record) => !('layerCode' in record.data)),
        `${what}: nečitelné záznamy`,
      ).toEqual(unreadable);
      expect(pageOf(prepared.device, CIRCLES), `${what}: stránka kruhů`).toEqual(
        prepared.otherPageBefore,
      );
    }
  });

  it('plné album nepřekročí 12 obrázků ani 24 záznamů ani při přerušení a dokončení po obnovení', async () => {
    const scenario: SwapScenario = { albumCount: 12, unreadable: 12, aIndex: 4 };
    const cuts = await cutsOf(scenario);

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      await reloadAndOpen(prepared.device);
      const what = `přerušení po ${cut}. zápisu`;
      expect(await wholeState(prepared, true), what).not.toBe('napůl');
      expect(
        prepared.device.maxRecords.get(EMA),
        `${what}: nikdy víc než 24 záznamů, z nich 12 nečitelných, tedy nejvýš 12 obrázků`,
      ).toBeLessThanOrEqual(24);
    }
  });

  it('i když se přeruší samo dokončení nebo vrácení výměny, další otevření ji dokončí nebo vrátí celou', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 1 };
    const cuts = await cutsOf(scenario);

    for (const cut of cuts) {
      for (let settleCut = 0; settleCut < SETTLE_CUTS; settleCut += 1) {
        const prepared = await interruptedSwap(scenario, cut);
        const { device } = prepared;
        device.nextLoad();
        const page = choiceOn(device);
        device.cutAfterWrites(settleCut);
        void settleOn(page);
        await settle();
        await reloadAndOpen(device);
        expect(
          await wholeState(prepared, true),
          `výměna přerušená po ${cut}. zápisu, její dokončení po ${settleCut}. zápisu`,
        ).not.toBe('napůl');
      }
    }
  });
});

describe('#131 AC5: když po obnovení album nejde přečíst', () => {
  it('nic se nesmaže ani nepřepíše a výměna se dokončí nebo vrátí při dalším otevření', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 1 };
    const cuts = await cutsOf(scenario);

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      const { device } = prepared;
      const what = `přerušení po ${cut}. zápisu`;
      device.nextLoad();
      device.recordsUnavailable = true;
      const before = device.snapshot();
      const page = choiceOn(device);
      await settleOn(page);
      await settle();
      expect(device.snapshot(), `${what}: s nečitelným albem se nic nezměnilo`).toEqual(before);

      device.repair();
      await reloadAndOpen(device);
      expect(await wholeState(prepared, true), `${what}: při dalším otevření`).not.toBe('napůl');
    }
  });

  it('dokud se neví, co s výměnou, náhled té omalovánky se jen zhoupne a dítě nemaluje do stránky, kterou by vrácení přepsalo', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 1 };
    const cuts = await cutsOf(scenario);

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      const { device } = prepared;
      const what = `přerušení po ${cut}. zápisu`;
      const pageAfterCut = pageOf(device);
      // Stav napůl (třeba stránka A a A dál v albu, nebo A pryč a P ještě ne)
      // znamená rozběhnutou výměnu, o které se s nečitelným albem neví, co s ní.
      const halfway = (await wholeState(prepared, true)) === 'napůl';
      device.nextLoad();
      device.recordsUnavailable = true;
      const page = choiceOn(device);
      await settleOn(page);
      await settle();

      const tap = page.choice.tapPreview(0);

      if (halfway) {
        expect(tap, `${what}: výměna napůl, náhled domku se jen zhoupne`).toEqual({
          kind: 'wobble',
          tones: HOME_WOBBLE_TONES,
        });
      }
      if (tap.kind === 'wobble') {
        expect(tap.tones, `${what}: tón domečku`).toEqual(HOME_WOBBLE_TONES);
        expect(page.choice.screen().kind, `${what}: dítě zůstane na výběru`).toBe('picker');
        expect(page.choice.tapPreview(1).kind, `${what}: jiná omalovánka se otevře`).toBe('open');
        continue;
      }
      expect(tap.kind, `${what}: náhled se zhoupne, nebo otevře`).toBe('open');
      // Dítě maluje do otevřené stránky; vrácení ani dokončení ji nesmí přepsat.
      const game = await showPainting(page, HOUSE);
      game.tapColor(P_COLOR + 7);
      game.pointerDown({ id: 1, x: 220, y: 100, kind: 'touch' });
      game.pointerMove({ id: 1, x: 280, y: 100, kind: 'touch' });
      game.pointerUp(1);
      const painted = pixelsOf(game, page.regions);
      vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
      page.choice.holdHome();
      game.suspend();

      device.repair();
      await reloadAndOpen(device);
      const album = await albumPixels(device);
      expect(pageOf(device), `${what}: stránka s tahy dítěte zůstala`).toEqual(painted);
      expect(timesIn(album, prepared.a), `${what}: A v albu nejvýš jednou`).toBeLessThanOrEqual(1);
      if (sameImage(pageAfterCut, prepared.a)) {
        expect(timesIn(album, prepared.p), `${what}: dítě malovalo A, P je v albu`).toBe(1);
        expect(timesIn(album, prepared.a), `${what}: A je na stránce, ne v albu`).toBe(0);
      }
    }
  });

  it('dokud se výměna, která se má vrátit, nevrátí, náhled té omalovánky se jen zhoupne s tónem domečku', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 1 };
    const cuts = await cutsOf(scenario);

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      const { device } = prepared;
      const what = `přerušení po ${cut}. zápisu`;
      const mustRevert =
        (await wholeState(prepared, true)) === 'napůl' &&
        timesIn(await albumPixels(device), prepared.a) === 1;
      device.nextLoad();
      const page = choiceOn(device);

      const settling = settleOn(page);
      const tap = page.choice.tapPreview(0);
      await settling;
      await settle();

      if (mustRevert) {
        expect(tap, `${what}: před vrácením se náhled jen zhoupne`).toEqual({
          kind: 'wobble',
          tones: HOME_WOBBLE_TONES,
        });
        expect(await wholeState(prepared, true), `${what}: výměna se vrátila`).toBe('před');
        expect(page.choice.tapPreview(0).kind, `${what}: po vrácení se náhled otevře`).toBe('open');
      }
    }
  });

  it('po dokončení nebo vrácení výměny jde náhled té omalovánky zase otevřít a ukazuje celý stav', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 1 };
    const cuts = await cutsOf(scenario);

    for (const cut of cuts) {
      const prepared = await interruptedSwap(scenario, cut);
      const { page } = await reloadAndOpen(prepared.device);
      const what = `přerušení po ${cut}. zápisu`;
      const state = await wholeState(prepared, true);

      const tap = page.choice.tapPreview(0);

      expect(tap.kind, `${what}: náhled domku otevře malování`).toBe('open');
      const game = await showPainting(page, HOUSE);
      expect(pixelsOf(game, page.regions), `${what}: malování ukazuje stav ${state}`).toEqual(
        state === 'před' ? prepared.p : prepared.a,
      );
    }
  });
});
