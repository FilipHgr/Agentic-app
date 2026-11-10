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
 * Pravidlo „text se vejde do své plochy“ (#82) není v `LAYOUT_RULES`,
 * protože ho zatím používá jen menu: obrazovka ho dostane zvlášť
 * (`textFitViolations`). Texty nese prvek (`texts`).
 *
 * Schválené výjimky (např. menší ťukací tečka na telefonu) nese přímo
 * prvek (`minSide`, `minEdge`) nebo obrazovka (`mayOverlap`, `gapExempt`)
 * a mají mít v testu odkaz na rozhodnutí.
 */

import { gapBetween, heightOf, overlaps, widthOf } from './viewportFixtures';
import type { Box, TestWindow } from './viewportFixtures';

/** Ťukací plocha pro dětský prst v CSS px (CLAUDE.md). */
export const MIN_TAP_SIDE = 64;

/** Nejmenší mezera mezi dvěma ťukacími plochami v CSS px. */
export const MIN_TAP_GAP = 8;

/** Nejmenší odstup prvku od okraje volné plochy v CSS px. */
export const MIN_EDGE_DISTANCE = 4;

/** Šířka znaku jako díl velikosti písma, odhad z #65. */
export const CHARACTER_WIDTH_RATIO = 0.6;

/** Rezerva na každé straně textu v CSS px (#65, #67). */
export const TEXT_PADDING = 8;

/**
 * Zkušební okna aplikace spuštěné z plochy (#78 AC3): bez lišty Safari,
 * s volnými okraji nahoře / vpravo / dole / vlevo podle zadání. Na iPadu
 * je nahoře stavový řádek (24 px), pod který hra ani menu nesmí. Pravidla
 * se na nich zkouší pro menu (`tests/menu/menuLayoutScenes.ts`) i pro
 * Počítání (`tests/games/counting/layoutScenes.ts`). iPad na výšku je mimo
 * rozsah (#34).
 */
export const HOME_SCREEN_WINDOWS: readonly TestWindow[] = [
  {
    name: 'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    width: 1180,
    height: 820,
    safeArea: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  {
    name: 'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    width: 430,
    height: 932,
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
  },
  {
    name: 'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    width: 393,
    height: 852,
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
  },
  {
    name: 'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    width: 932,
    height: 430,
    safeArea: { top: 0, right: 59, bottom: 21, left: 59 },
  },
];

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Text v prvku, který se do své plochy musí vejít (#82). */
export interface LayoutText {
  /** Text, jak ho dítě uvidí. */
  readonly text: string;
  /** Velikost písma v CSS px. */
  readonly fontSize: number;
  /** Šířka znaku jako díl písma, výchozí 0,6 (#65); široké „W“ se počítá jako 1,0. */
  readonly charWidth?: number;
  /** Plocha textu, když je menší než prvek (pilulka v ťukací ploše kategorie). */
  readonly box?: Box;
  /** Nejvýš tolik řádků, výchozí 1; text se rozdělí na řádky rovným dílem. */
  readonly maxLines?: number;
  /** Výška řádku v CSS px, výchozí velikost písma. */
  readonly lineHeight?: number;
  /** Rezerva na každé straně v CSS px, výchozí 8 px. */
  readonly padding?: number;
  /** Místo navíc v řádku vedle textu v CSS px (např. pro ✓), výchozí 0. */
  readonly reserve?: number;
}

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
  /**
   * Celý prvek, když `box` je jen jeho viditelná část v posouvané ploše
   * (#82). Pravidla 64 px a „text se vejde“ měří celý prvek, ostatní
   * pravidla viditelnou část.
   */
  readonly whole?: Box;
  /**
   * Posouvaný prvek, který při tomto posunu není vidět vůbec (#82). Měří
   * ho jen pravidla 64 px a „text se vejde“ (na `whole`), ostatní ho
   * přeskočí, protože na obrazovce není.
   */
  readonly hidden?: boolean;
  /** Texty v prvku pro pravidlo „text se vejde do své plochy“. */
  readonly texts?: readonly LayoutText[];
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
  /**
   * Schválená menší mezera mezi dvojicí ťukacích ploch v CSS px (výchozí
   * 8 px). Mezera 0 px znamená „nesmí se překrývat“.
   */
  readonly minGap?: (first: LayoutItem, second: LayoutItem) => number | undefined;
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

/** Prvky, které jsou na obrazovce vidět (bez skrytých posouvaných prvků). */
function shownItems(scene: LayoutScene): LayoutItem[] {
  return scene.items.filter((item) => !item.hidden);
}

function drawnItems(scene: LayoutScene): LayoutItem[] {
  return shownItems(scene).filter((item) => !item.reserved);
}

/** Ťukací plochy včetně skrytých posouvaných prvků (pro pravidlo 64 px). */
function allTapItems(scene: LayoutScene): LayoutItem[] {
  return scene.items.filter((item) => item.tappable === true && !item.reserved);
}

function tapItems(scene: LayoutScene): LayoutItem[] {
  return allTapItems(scene).filter((item) => !item.hidden);
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
  return pairsOf(shownItems(scene))
    .filter(([first, second]) => !(first.reserved && second.reserved))
    .filter(([first, second]) => overlaps(first.box, second.box))
    .filter(([first, second]) => !scene.mayOverlap?.(first, second))
    .map(([first, second]) => `${scene.label}: ${first.name} se překrývá s ${second.name}`);
}

/** Pravidlo „ťukací plocha aspoň 64 px“ (nebo schválená menší plocha prvku). */
export function tapSizeViolations(scene: LayoutScene): string[] {
  return allTapItems(scene).flatMap((item) => {
    const minSide = item.minSide ?? MIN_TAP_SIDE;
    // Posouvaný prvek se měří celý (`whole`), i když je vidět jen jeho část
    // nebo vůbec: prst ho trefuje po posunutí celý, oříznutá část u okraje
    // posouvané plochy nesmí pravidlo shodit ani obejít (#82).
    const whole = item.whole ?? item.box;
    const width = widthOf(whole);
    const height = heightOf(whole);
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
      const required = scene.minGap?.(first, second) ?? MIN_TAP_GAP;
      if (gap >= required - TOLERANCE) {
        return [];
      }
      return [
        `${scene.label}: mezi ${first.name} a ${second.name} je jen ${px(gap)}, potřebuje aspoň ${px(required)}`,
      ];
    });
}

/** Porušení jednoho textu: příliš široký nebo vysoký pro svou plochu. */
function textProblems(label: string, item: LayoutItem, text: LayoutText): string[] {
  if (text.text.trim() === '') {
    return [`${label}: v ${item.name} chybí text`];
  }
  const area = text.box ?? item.whole ?? item.box;
  const lines = text.maxLines ?? 1;
  const charactersPerLine = Math.ceil([...text.text].length / lines);
  const padding = text.padding ?? TEXT_PADDING;
  const needWidth =
    charactersPerLine * (text.charWidth ?? CHARACTER_WIDTH_RATIO) * text.fontSize +
    2 * padding +
    (text.reserve ?? 0);
  const needHeight = lines * (text.lineHeight ?? text.fontSize);
  const where = `${label}: text „${text.text}“ v ${item.name}`;
  const problems: string[] = [];
  if (needWidth > widthOf(area) + TOLERANCE) {
    problems.push(`${where} potřebuje šířku ${px(needWidth)}, plocha má ${px(widthOf(area))}`);
  }
  if (needHeight > heightOf(area) + TOLERANCE) {
    problems.push(`${where} potřebuje výšku ${px(needHeight)}, plocha má ${px(heightOf(area))}`);
  }
  return problems;
}

/**
 * Pravidlo „text se vejde do své plochy“ (#82): text není prázdný, šířka podle #65
 * (znaky × 0,6 × písmo) s rezervou 8 px z obou stran a výška řádků.
 * Víceřádkový text (přezdívka na dva řádky, #72) se dělí rovným dílem.
 */
export function textFitViolations(scene: LayoutScene): string[] {
  return scene.items.flatMap((item) =>
    (item.texts ?? []).flatMap((text) => textProblems(scene.label, item, text)),
  );
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
