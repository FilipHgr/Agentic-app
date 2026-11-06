/**
 * Společná pravidla rozložení obrazovky (#81): vejde se do okna i mimo
 * výřez, nic se nepřekrývá, ťukací plocha aspoň 64 px, mezera mezi
 * ťukacími plochami aspoň 8 px a odstup aspoň 4 px od okraje.
 *
 * Pravidla nevědí nic o konkrétní hře ani menu. Dostanou obrazovku
 * (`LayoutScene`): popis případu (okno, rozsah, ovládání…), volnou plochu
 * okna a prvky v CSS px. Vrátí seznam porušení jako čitelné věty, např.
 * „390×844, do 20, psaní: okénko 2 přesahuje spodní okraj o 3 px“.
 * Prázdný seznam znamená, že pravidlo platí.
 *
 * Schválené výjimky (např. menší ťukací tečka na telefonu) nese přímo
 * prvek (`minSide`, `minEdge`) nebo obrazovka (`mayOverlap`, `gapExempt`)
 * a mají mít v testu odkaz na rozhodnutí.
 */

import { gapBetween, heightOf, overlaps, widthOf } from './viewportFixtures';
import type { Box } from './viewportFixtures';

/** Ťukací plocha pro dětský prst v CSS px (CLAUDE.md). */
export const MIN_TAP_SIDE = 64;

/** Nejmenší mezera mezi dvěma ťukacími plochami v CSS px. */
export const MIN_TAP_GAP = 8;

/** Nejmenší odstup prvku od okraje volné plochy v CSS px. */
export const MIN_EDGE_DISTANCE = 4;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

export interface LayoutItem {
  /** Jak prvek pozná člověk: „okénko 2“, „tlačítko 7“, „✓“. */
  readonly name: string;
  /** Obdélník prvku v CSS px okna. */
  readonly box: Box;
  /** Jde na prvek ťuknout? Jen ťukací plochy hlídá pravidlo 64 px a 8 px. */
  readonly tappable?: boolean;
  /** Schválená výjimka z 64 px (CSS px), s odkazem na rozhodnutí v testu. */
  readonly minSide?: number;
  /** Přísnější nebo schválený odstup od okraje (CSS px), výchozí 4 px. */
  readonly minEdge?: number;
  /**
   * Vyhrazené místo, na které se nic nekreslí (roh kolečka, roh domečku).
   * Hlídá ho jen pravidlo „nic se nepřekrývá“, do okna se vejít nemusí.
   */
  readonly reserved?: boolean;
}

export interface LayoutScene {
  /** Popis případu: okno, rozsah, ovládání a další okolnosti. */
  readonly label: string;
  /** Volná plocha okna (bez výřezu a lišty domů) v CSS px. */
  readonly free: Box;
  readonly items: readonly LayoutItem[];
  /** Schválený překryv dvou prvků (např. tečky nápovědy ve vyhrazeném místě). */
  readonly mayOverlap?: (first: LayoutItem, second: LayoutItem) => boolean;
  /** Dvojice ťukacích ploch, mezi kterými se 8 px nehlídá (např. tečky těsně vedle sebe). */
  readonly gapExempt?: (first: LayoutItem, second: LayoutItem) => boolean;
}

/** Číslo pro zprávu: nejvýš dvě desetinná místa s desetinnou čárkou. */
function px(value: number): string {
  return `${String(Math.round(value * 100) / 100).replace('.', ',')} px`;
}

function pairsOf<T>(items: readonly T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  items.forEach((first, index) => {
    for (const second of items.slice(index + 1)) {
      pairs.push([first, second]);
    }
  });
  return pairs;
}

function drawnItems(scene: LayoutScene): LayoutItem[] {
  return scene.items.filter((item) => !item.reserved);
}

function tapItems(scene: LayoutScene): LayoutItem[] {
  return scene.items.filter((item) => item.tappable === true && !item.reserved);
}

/** Přesahy obdélníku přes hranice `area` o víc než `margin` (věty „přesahuje levý okraj o …“). */
function overhangs(item: LayoutItem, area: Box, margin: number): string[] {
  const { box } = item;
  const sides: Array<[string, number]> = [
    ['levý', area.left + margin - box.left],
    ['pravý', box.right - (area.right - margin)],
    ['horní', area.top + margin - box.top],
    ['spodní', box.bottom - (area.bottom - margin)],
  ];
  return sides
    .filter(([, overhang]) => overhang > TOLERANCE)
    .map(([side, overhang]) => `${side} okraj o ${px(overhang)}`);
}

/** Pravidlo „vejde se do okna i mimo výřez“: každý prvek je celý ve volné ploše. */
export function fitViolations(scene: LayoutScene): string[] {
  return drawnItems(scene).flatMap((item) =>
    overhangs(item, scene.free, 0).map(
      (overhang) => `${scene.label}: ${item.name} přesahuje ${overhang}`,
    ),
  );
}

/** Pravidlo „aspoň 4 px od okraje“ volné plochy (nebo schválený odstup prvku). */
export function edgeViolations(scene: LayoutScene): string[] {
  return drawnItems(scene).flatMap((item) => {
    const margin = item.minEdge ?? MIN_EDGE_DISTANCE;
    return overhangs(item, scene.free, margin).map(
      (overhang) => `${scene.label}: ${item.name} je blíž než ${px(margin)} k okraji, ${overhang}`,
    );
  });
}

/** Pravidlo „nic se nepřekrývá“ (dotyk hranou se nepočítá). */
export function overlapViolations(scene: LayoutScene): string[] {
  return pairsOf(scene.items)
    .filter(([first, second]) => !(first.reserved && second.reserved))
    .filter(([first, second]) => overlaps(first.box, second.box))
    .filter(([first, second]) => !scene.mayOverlap?.(first, second))
    .map(([first, second]) => `${scene.label}: ${first.name} se překrývá s ${second.name}`);
}

/** Pravidlo „ťukací plocha aspoň 64 px“ (nebo schválená menší plocha prvku). */
export function tapSizeViolations(scene: LayoutScene): string[] {
  return tapItems(scene).flatMap((item) => {
    const minSide = item.minSide ?? MIN_TAP_SIDE;
    const width = widthOf(item.box);
    const height = heightOf(item.box);
    if (width >= minSide - TOLERANCE && height >= minSide - TOLERANCE) {
      return [];
    }
    return [
      `${scene.label}: ${item.name} má jen ${px(width)} × ${px(height)}, potřebuje aspoň ${px(minSide)}`,
    ];
  });
}

/** Pravidlo „mezera mezi ťukacími plochami aspoň 8 px“. */
export function tapGapViolations(scene: LayoutScene): string[] {
  return pairsOf(tapItems(scene))
    .filter(([first, second]) => !scene.gapExempt?.(first, second))
    .flatMap(([first, second]) => {
      const gap = gapBetween(first.box, second.box);
      if (gap >= MIN_TAP_GAP - TOLERANCE) {
        return [];
      }
      return [
        `${scene.label}: mezi ${first.name} a ${second.name} je jen ${px(gap)}, potřebuje aspoň ${px(MIN_TAP_GAP)}`,
      ];
    });
}

export type LayoutRule = (scene: LayoutScene) => string[];

/** Všechna pravidla podle názvu, jak se píšou v testech. */
export const LAYOUT_RULES: Readonly<Record<string, LayoutRule>> = {
  'vejde se do okna i mimo výřez': fitViolations,
  'nic se nepřekrývá': overlapViolations,
  'ťukací plocha aspoň 64 px': tapSizeViolations,
  'mezera mezi plochami aspoň 8 px': tapGapViolations,
  'aspoň 4 px od okraje': edgeViolations,
};
