import { describe, expect, it } from 'vitest';

import {
  keyRewardMomentAt,
  mapClosableFromMs,
  markerShareAt,
  starFlightPointAt,
  starFlightShareAt,
} from '../../../src/shared/logic/mapAnimation';
import type { MapPoint } from '../../../src/shared/logic/progressMapLayout';
import { STARS_PER_SET } from '../../../src/shared/logic/stars';
import type { KeyReward } from '../../../src/shared/logic/keyRewards';
import { POINT_TOLERANCE, allMoves, samePoint } from './mapAnimationHelpers';

/**
 * Testy k #154 AC3 a AC6 na časové ose karty s mapou (čistá logika, bez
 * sezení): po ukázání karty odletí 10 hvězdiček z řady ke značce nejvýš
 * za 0,6 s, teprve potom jde značka po cestě (#135) a hranice ťuknutí
 * (#145 AC4) i limit 5 s pro klíč (#145 AC3, #139 AC2) se posunou o dobu
 * letu, nejvýš na 5,6 s. Při otočení zařízení let pokračuje ze stejné
 * části dráhy mezi novými polohami řady a značky.
 * Každé pravidlo projde v cyklu všechny hvězdičky řady nebo všechny kroky
 * na všech 5 mapách (`allMoves`), popis případu je ve zprávě `expect`.
 *
 * Navržené rozhraní (`mapAnimation.ts`, čistý TypeScript bez Phaseru,
 * časy v ms od ukázání karty jako ostatní časová osa mapy):
 * - `starFlightShareAt(starIndex: number, elapsedMs: number): number`
 *   jaký díl dráhy z řady ke značce má hvězdička `starIndex` (0 až 9)
 *   za sebou: 0 na začátku, 1 po doletu, mezi tím neklesá. Hvězdičky
 *   smí vyletět postupně, všechny doletí nejvýš za 0,6 s.
 * - `starFlightPointAt(from: MapPoint, to: MapPoint, starIndex: number,
 *   elapsedMs: number): MapPoint` kde hvězdička letí mezi svým místem
 *   v řadě `from` a značkou `to` (obě v CSS px okna, scéna je po otočení
 *   předá nové). Dráha smí být oblouk, ale její tvar plyne jen z `from`
 *   a `to`, ne z velikosti okna.
 * - `markerShareAt`, `keyRewardMomentAt` a `mapClosableFromMs` počítají
 *   s letem: značka vyrazí až po doletu poslední hvězdičky.
 *
 * Ručně se kontroluje (AC7): let se pozná na první pohled a běží v 60 fps.
 */

/** Nejdéle letí hvězdičky ke značce, ms od ukázání karty (AC3). */
const FLIGHT_LIMIT_MS = 600;

/** Nejpozději tehdy jde kartu zavřít ťuknutím a doběhne klíč (AC3). */
const SHIFTED_LIMIT_MS = 5600;

/** Do kdy se časová osa kontroluje: o 1 s za 7 s karty. */
const CHECK_UNTIL_MS = 8000;

const STAR_INDEXES = Array.from({ length: STARS_PER_SET }, (_, index) => index);

/** První ms, kdy platí `condition`, nebo `null`. */
function firstMs(condition: (ms: number) => boolean): number | null {
  for (let ms = 0; ms <= CHECK_UNTIL_MS; ms += 1) {
    if (condition(ms)) {
      return ms;
    }
  }
  return null;
}

/** Kdy doletí poslední hvězdička (všechny mají díl 1). */
function flightEndMs(): number {
  return (
    firstMs((ms) => STAR_INDEXES.every((star) => starFlightShareAt(star, ms) >= 1)) ?? Infinity
  );
}

/** Poslední ms, kdy se ukázání klíče ještě změnilo. */
function keyLastChangeMs(reward: KeyReward): number {
  let last = 0;
  let previous = JSON.stringify(keyRewardMomentAt(reward, 0));
  for (let ms = 1; ms <= CHECK_UNTIL_MS; ms += 1) {
    const current = JSON.stringify(keyRewardMomentAt(reward, ms));
    if (current !== previous) {
      last = ms;
    }
    previous = current;
  }
  return last;
}

/** Místo hvězdičky v řadě a značka na mapě ve dvou oknech (na šířku a na výšku). */
const FLIGHT_ENDS: ReadonlyArray<{ label: string; row: MapPoint; marker: MapPoint }> = [
  { label: 'iPad na šířku', row: { x: 820, y: 40 }, marker: { x: 300, y: 520 } },
  { label: 'telefon na výšku', row: { x: 120, y: 90 }, marker: { x: 260, y: 600 } },
  { label: 'značka nad řadou', row: { x: 500, y: 700 }, marker: { x: 100, y: 60 } },
];

/** Stejné zvětšení a posun obou konců (jiné okno se stejným tvarem rozložení). */
function scaled(point: MapPoint, factor: number, shift: MapPoint): MapPoint {
  return { x: point.x * factor + shift.x, y: point.y * factor + shift.y };
}

describe('#154 AC3: po ukázání okna odletí 10 hvězdiček ke značce nejvýš za 0,6 s', () => {
  it('při ukázání okna jsou všechny hvězdičky ještě v řadě', () => {
    for (const star of STAR_INDEXES) {
      expect(starFlightShareAt(star, 0), `hvězdička ${star + 1}`).toBe(0);
    }
  });

  it('všech 10 hvězdiček doletí ke značce nejpozději 0,6 s po ukázání okna a už tam zůstanou', () => {
    for (const star of STAR_INDEXES) {
      expect(starFlightShareAt(star, FLIGHT_LIMIT_MS), `hvězdička ${star + 1}`).toBe(1);
      for (let ms = FLIGHT_LIMIT_MS; ms <= CHECK_UNTIL_MS; ms += 50) {
        expect(starFlightShareAt(star, ms), `hvězdička ${star + 1}, ${ms} ms`).toBe(1);
      }
    }
  });

  it('hvězdička letí plynule dopředu: díl dráhy je od 0 do 1 a nikdy neklesá', () => {
    for (const star of STAR_INDEXES) {
      let before = 0;
      for (let ms = 0; ms <= FLIGHT_LIMIT_MS; ms += 1) {
        const share = starFlightShareAt(star, ms);
        expect(share, `hvězdička ${star + 1}, ${ms} ms`).toBeGreaterThanOrEqual(before);
        expect(share, `hvězdička ${star + 1}, ${ms} ms`).toBeLessThanOrEqual(1);
        before = share;
      }
    }
  });

  it('hvězdička opravdu letí: cestou je vidět i mezi řadou a značkou, nepřeskočí', () => {
    for (const star of STAR_INDEXES) {
      let seenOnTheWay = false;
      for (let ms = 0; ms <= FLIGHT_LIMIT_MS; ms += 1) {
        const share = starFlightShareAt(star, ms);
        if (share > 0.25 && share < 0.75) {
          seenOnTheWay = true;
        }
      }
      expect(seenOnTheWay, `hvězdička ${star + 1}`).toBe(true);
    }
  });

  it('hvězdička vyletí ze svého místa v řadě a skončí přesně na značce', () => {
    for (const { label, row, marker } of FLIGHT_ENDS) {
      for (const star of STAR_INDEXES) {
        const where = `${label}, hvězdička ${star + 1}`;
        expect(samePoint(starFlightPointAt(row, marker, star, 0), row), where).toBe(true);
        expect(
          samePoint(starFlightPointAt(row, marker, star, FLIGHT_LIMIT_MS), marker),
          where,
        ).toBe(true);
      }
    }
  });
});

describe('#154 AC3: teprve po letu hvězdiček jde značka po cestě', () => {
  it('značka stojí na minulém místě, dokud nedoletí poslední hvězdička', () => {
    const end = flightEndMs();
    expect(end).toBeLessThanOrEqual(FLIGHT_LIMIT_MS);
    for (let ms = 0; ms <= end; ms += 1) {
      expect(markerShareAt(ms), `${ms} ms`).toBe(0);
    }
  });

  it('po doletu hvězdiček značka dojde na nové místo nejvýš za 1,5 s (#135 AC1)', () => {
    const end = flightEndMs();
    const arrived = firstMs((ms) => markerShareAt(ms) >= 1);
    expect(arrived).not.toBeNull();
    expect((arrived ?? Infinity) - end).toBeLessThanOrEqual(1500);
  });
});

describe('#154 AC3: hranice ťuknutí a limit klíče se posunou o let, nejvýš na 5,6 s', () => {
  it('ťuknutím jde okno zavřít až po doletu hvězdiček a nejpozději 5,6 s od ukázání', () => {
    const end = flightEndMs();
    for (const { label, move } of allMoves()) {
      const rewards: ReadonlyArray<KeyReward | null> = move.reachedGoal
        ? [null, 'half', 'wholeKey']
        : [null];
      for (const reward of rewards) {
        const closable = mapClosableFromMs(move, reward);
        const where = `${label}, ${String(reward)}`;
        expect(closable, `${where}: ne během letu`).toBeGreaterThan(end);
        expect(closable, where).toBeLessThanOrEqual(SHIFTED_LIMIT_MS);
      }
    }
  });

  it('půlka klíče i spojení půlek doběhnou do 5 s od doletu hvězdiček, nejvýš 5,6 s od ukázání', () => {
    const end = flightEndMs();
    for (const reward of ['half', 'wholeKey'] as const) {
      const last = keyLastChangeMs(reward);
      expect(last, reward).toBeLessThanOrEqual(end + 5000);
      expect(last, reward).toBeLessThanOrEqual(SHIFTED_LIMIT_MS);
    }
  });

  it('půlka klíče se neukáže během letu hvězdiček', () => {
    const end = flightEndMs();
    for (const reward of ['half', 'wholeKey'] as const) {
      for (let ms = 0; ms <= end; ms += 1) {
        expect(keyRewardMomentAt(reward, ms).visible, `${reward}, ${ms} ms`).toBe(false);
      }
    }
  });
});

describe('#154 AC6: otočení zařízení během letu hvězdiček', () => {
  it('po otočení pokračuje let ze stejné části dráhy mezi novými polohami řady a značky', () => {
    const changes: ReadonlyArray<{ factor: number; shift: MapPoint }> = [
      { factor: 0.5, shift: { x: 0, y: 0 } },
      { factor: 1.8, shift: { x: -120, y: 40 } },
      { factor: 1, shift: { x: 300, y: -200 } },
    ];
    for (const { label, row, marker } of FLIGHT_ENDS) {
      for (const { factor, shift } of changes) {
        for (const star of STAR_INDEXES) {
          for (let ms = 0; ms <= FLIGHT_LIMIT_MS; ms += 25) {
            const where = `${label}, ×${factor}, hvězdička ${star + 1}, ${ms} ms`;
            const before = starFlightPointAt(row, marker, star, ms);
            const after = starFlightPointAt(
              scaled(row, factor, shift),
              scaled(marker, factor, shift),
              star,
              ms,
            );
            const expected = scaled(before, factor, shift);
            expect(Math.abs(after.x - expected.x), where).toBeLessThanOrEqual(
              POINT_TOLERANCE * Math.max(1, factor),
            );
            expect(Math.abs(after.y - expected.y), where).toBeLessThanOrEqual(
              POINT_TOLERANCE * Math.max(1, factor),
            );
          }
        }
      }
    }
  });

  it('po otočení se hvězdička dál jen blíží ke značce, nevrátí se do řady', () => {
    for (const star of STAR_INDEXES) {
      for (const rotatedAt of [100, 250, 400]) {
        const shareAtRotation = starFlightShareAt(star, rotatedAt);
        for (let ms = rotatedAt; ms <= FLIGHT_LIMIT_MS; ms += 10) {
          expect(
            starFlightShareAt(star, ms),
            `hvězdička ${star + 1}, ${ms} ms`,
          ).toBeGreaterThanOrEqual(shareAtRotation);
        }
      }
    }
  });
});
