import { describe, expect, it } from 'vitest';

import { RUDY_SHEET } from '../../src/shared/logic/rudy';
import {
  RUDY_HEIGHT_SHARE,
  RUDY_HOP_TIMES,
  RUDY_MIN_HEIGHT_CSS,
  layoutRudyStage,
  rudyHopTop,
} from '../../src/shared/logic/rudyStage';
import type { RudyRect, RudyStageLayout } from '../../src/shared/logic/rudyStage';
import { gameAreaFor } from '../../src/shared/logic/viewportLayout';
import type { GameArea, GameAreaFit, Viewport } from '../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS } from './layoutRules';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  viewportOf,
} from './viewportFixtures';
import type { TestWindow } from './viewportFixtures';

/**
 * Testy k #186 AC2: Rudy je přímo na obrazovce přes hru, bez karty,
 * okraje a ztmavení. Přiskočí zdola na střed obrazovky, tam slaví a mluví
 * a pak odskočí dolů. Na místě je celý vidět, aspoň 200 px vysoký a nic
 * z něj neuřízne okraj obrazovky (výřez, stavový řádek, lišta domů) ani
 * okraj plátna hry. Během skoků nahoru i dolů ho neuřízne horní okraj ani
 * boky, jen zespodu vyjíždí zpoza spodního okraje plátna.
 *
 * Pravidla v cyklu přes zkušební okna z testů rozložení, pro hru s dnešní
 * plochou (`fixed`) i s plochou přes celé okno (`fullWindow`). Jeden test
 * na pravidlo, případ v popisu `expect`.
 */

const WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
  ...HOME_SCREEN_WINDOWS,
];

const FITS: readonly GameAreaFit[] = ['fixed', 'fullWindow'];

const TOLERANCE = 0.01;

/** Časy skoků, ve kterých se kontroluje poloha (po 1/60 s jako snímky). */
function hopTimes(durationMs: number): number[] {
  const times: number[] = [];
  for (let elapsed = 0; elapsed <= durationMs + 50; elapsed += 1000 / 60) {
    times.push(elapsed);
  }
  return times;
}

interface Case {
  readonly name: string;
  readonly viewport: Viewport;
  readonly area: GameArea;
  readonly layout: RudyStageLayout;
}

const CASES: readonly Case[] = WINDOWS.flatMap((window) =>
  FITS.map((fit) => {
    const viewport = viewportOf(window);
    const area = gameAreaFor(viewport, fit);
    return {
      name: `${window.name}, ${fit}`,
      viewport,
      area,
      layout: layoutRudyStage(viewport, area),
    };
  }),
);

function rightOf(rect: RudyRect): number {
  return rect.left + rect.width;
}

function bottomOf(rect: RudyRect): number {
  return rect.top + rect.height;
}

function isInside(inner: RudyRect, outer: RudyRect): boolean {
  return (
    inner.left >= outer.left - TOLERANCE &&
    inner.top >= outer.top - TOLERANCE &&
    rightOf(inner) <= rightOf(outer) + TOLERANCE &&
    bottomOf(inner) <= bottomOf(outer) + TOLERANCE
  );
}

function safeRect(viewport: Viewport): RudyRect {
  const { safeArea } = viewport;
  return {
    left: safeArea.left,
    top: safeArea.top,
    width: viewport.width - safeArea.left - safeArea.right,
    height: viewport.height - safeArea.top - safeArea.bottom,
  };
}

function canvasRect(area: GameArea): RudyRect {
  return {
    left: area.offsetX,
    top: area.offsetY,
    width: area.width * area.scale,
    height: area.height * area.scale,
  };
}

/** Horní okraj obrazovky, který Rudy nesmí přesáhnout: výřez i plátno. */
function topLimit(viewport: Viewport, area: GameArea): number {
  return Math.max(viewport.safeArea.top, area.offsetY);
}

function describeRect(rect: RudyRect): string {
  return `${rect.left},${rect.top} ${rect.width}×${rect.height}`;
}

describe('#186 AC2: Rudy stojí na obrazovce celý vidět', () => {
  it('na místě je Rudy celý v bezpečné oblasti okna (nic ho neuřízne)', () => {
    for (const { name, viewport, layout } of CASES) {
      expect(
        isInside(layout.panda, safeRect(viewport)),
        `${name}: ${describeRect(layout.panda)}`,
      ).toBe(true);
    }
  });

  it('na místě je Rudy celý na plátně hry, aby se dal nakreslit', () => {
    for (const { name, area, layout } of CASES) {
      expect(
        isInside(layout.panda, canvasRect(area)),
        `${name}: ${describeRect(layout.panda)}`,
      ).toBe(true);
    }
  });

  it('Rudy je aspoň 200 px vysoký', () => {
    expect(RUDY_MIN_HEIGHT_CSS).toBe(200);
    for (const { name, layout } of CASES) {
      expect(layout.panda.height, `${name}: ${layout.panda.height} px`).toBeGreaterThanOrEqual(
        RUDY_MIN_HEIGHT_CSS,
      );
    }
  });

  it('Rudy je velký: 55 % menší strany okna, jen když se nevejde, tak menší', () => {
    for (const { name, viewport, area, layout } of CASES) {
      const share = RUDY_HEIGHT_SHARE * Math.min(viewport.width, viewport.height);
      const room = Math.min(
        safeRect(viewport).height,
        canvasRect(area).height,
        (safeRect(viewport).width * RUDY_SHEET.frameHeight) / RUDY_SHEET.frameWidth,
      );
      expect(
        layout.panda.height,
        `${name}: ${layout.panda.height} px, 55 % = ${share}`,
      ).toBeGreaterThanOrEqual(Math.min(share, room) - 1);
    }
  });

  it('Rudy stojí uprostřed obrazovky a má poměr stran snímku', () => {
    for (const { name, viewport, area, layout } of CASES) {
      const safe = safeRect(viewport);
      const canvas = canvasRect(area);
      const visible = {
        left: Math.max(safe.left, canvas.left),
        top: Math.max(safe.top, canvas.top),
        right: Math.min(rightOf(safe), rightOf(canvas)),
        bottom: Math.min(bottomOf(safe), bottomOf(canvas)),
      };
      const offset = {
        x: layout.panda.left + layout.panda.width / 2 - (visible.left + visible.right) / 2,
        y: layout.panda.top + layout.panda.height / 2 - (visible.top + visible.bottom) / 2,
      };
      expect(Math.abs(offset.x), `${name}: vodorovně o ${offset.x} px`).toBeLessThanOrEqual(1);
      expect(Math.abs(offset.y), `${name}: svisle o ${offset.y} px`).toBeLessThanOrEqual(1);
      expect(layout.panda.width / layout.panda.height, name).toBeCloseTo(
        RUDY_SHEET.frameWidth / RUDY_SHEET.frameHeight,
        3,
      );
    }
  });
});

describe('#186 AC2: Rudy přiskočí zdola a odskočí dolů', () => {
  it('přískok i odskok jsou krátké (nejvýš 0,6 s), aby dítě nečekalo', () => {
    expect(RUDY_HOP_TIMES.inMs).toBeGreaterThan(0);
    expect(RUDY_HOP_TIMES.inMs).toBeLessThanOrEqual(600);
    expect(RUDY_HOP_TIMES.outMs).toBeGreaterThan(0);
    expect(RUDY_HOP_TIMES.outMs).toBeLessThanOrEqual(600);
  });

  it('na začátku přískoku je Rudy celý pod spodním okrajem plátna (ještě není vidět)', () => {
    for (const { name, area, layout } of CASES) {
      expect(rudyHopTop(layout, 'in', 0), name).toBeGreaterThanOrEqual(
        bottomOf(canvasRect(area)) - TOLERANCE,
      );
    }
  });

  it('po přískoku stojí Rudy přesně na svém místě', () => {
    for (const { name, layout } of CASES) {
      for (const elapsed of [RUDY_HOP_TIMES.inMs, RUDY_HOP_TIMES.inMs + 2000]) {
        expect(rudyHopTop(layout, 'in', elapsed), `${name}: po ${elapsed} ms`).toBeCloseTo(
          layout.panda.top,
          3,
        );
      }
    }
  });

  it('cestou nahoru Rudy jde zdola: nikdy není níž než na začátku', () => {
    for (const { name, layout } of CASES) {
      const start = rudyHopTop(layout, 'in', 0);
      const halfway = rudyHopTop(layout, 'in', RUDY_HOP_TIMES.inMs / 2);
      expect(halfway, `${name}: v půlce přískoku`).toBeLessThan(start);
      for (const elapsed of hopTimes(RUDY_HOP_TIMES.inMs)) {
        expect(rudyHopTop(layout, 'in', elapsed), `${name}: po ${elapsed} ms`).toBeLessThanOrEqual(
          start + TOLERANCE,
        );
      }
    }
  });

  it('během přískoku ani odskoku Rudyho neuřízne horní okraj obrazovky ani plátna', () => {
    for (const { name, viewport, area, layout } of CASES) {
      const limit = topLimit(viewport, area);
      for (const phase of ['in', 'out'] as const) {
        const duration = phase === 'in' ? RUDY_HOP_TIMES.inMs : RUDY_HOP_TIMES.outMs;
        for (const elapsed of hopTimes(duration)) {
          const top = rudyHopTop(layout, phase, elapsed);
          expect(top, `${name}: ${phase} po ${Math.round(elapsed)} ms`).toBeGreaterThanOrEqual(
            limit - TOLERANCE,
          );
        }
      }
    }
  });

  it('odskok začne na místě Rudyho a skončí celý pod spodním okrajem plátna', () => {
    for (const { name, area, layout } of CASES) {
      expect(rudyHopTop(layout, 'out', 0), `${name}: začátek`).toBeCloseTo(layout.panda.top, 3);
      expect(
        rudyHopTop(layout, 'out', RUDY_HOP_TIMES.outMs),
        `${name}: konec`,
      ).toBeGreaterThanOrEqual(bottomOf(canvasRect(area)) - TOLERANCE);
    }
  });

  it('nesmyslný čas skoku Rudyho nikam neodhodí (začátek skoku)', () => {
    for (const { name, layout } of CASES) {
      expect(rudyHopTop(layout, 'in', Number.NaN), name).toBe(rudyHopTop(layout, 'in', 0));
      expect(rudyHopTop(layout, 'out', -5), name).toBe(rudyHopTop(layout, 'out', 0));
    }
  });
});
