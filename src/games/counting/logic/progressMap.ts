/**
 * Mapa postupu v Počítání (#87, #133): za každou plnou řadu hvězdiček jde
 * značka hráče o krok dál. Mapa má 3 kroky, krok 0 je start, 1 a 2
 * zastávky a krok 3 cíl. Po cíli začne další plná řada další mapu
 * z 5 map ve stálém pořadí. Jen dopředu, nic se nebere.
 * Čistý TypeScript bez Phaseru; uložení řeší
 * `src/games/counting/storage/mapStorage.ts`, rozmístění míst
 * `progressMapLayout.ts` a kreslení scéna.
 */

/** Kolik kroků (plných řad) je od startu do cíle. */
export const MAP_STEPS = 3;

/** Kolik kroků měla mapa z #87; takový záznam se při čtení převede. */
const LEGACY_MAP_STEPS = 8;

/** Označení tvaru záznamu se 3 kroky; záznam bez něj je z #87. */
const MAP_RECORD_FORMAT = 2;

/** Mapy ve stálém pořadí (#133 AC2): ostrov s pokladem, les, hrad, podmoří, vesmír. */
export const MAP_THEMES = ['island', 'forest', 'castle', 'underwater', 'space'] as const;

export type MapThemeId = (typeof MAP_THEMES)[number];

/** Mapa, která se hraje: plyne jen z počtu dokončených map (#133 AC3). */
export function mapThemeFor(completedMaps: number): MapThemeId {
  const index = completedMaps % MAP_THEMES.length;
  return MAP_THEMES[index] ?? MAP_THEMES[0];
}

/** Jak dlouho je mapa po oslavě vidět. */
export const MAP_SHOW_MS = 3000;

/** Jak dlouho je mapa vidět, když značka dojde do cíle. */
export const MAP_GOAL_SHOW_MS = 5000;

export interface MapProgress {
  /** Kde stojí značka: 0 start, `MAP_STEPS` cíl. */
  readonly step: number;
  /** Kolik map hráč už prošel až do cíle. */
  readonly completedMaps: number;
}

/** Nový hráč: na startu, žádná dokončená mapa. */
export const START_MAP: MapProgress = { step: 0, completedMaps: 0 };

/** Jeden krok značky, který mapa ukáže. */
export interface MapMove {
  readonly from: number;
  readonly to: number;
  /** Značka právě došla do cíle. */
  readonly reachedGoal: boolean;
  /** Mapa, na které krok proběhl; v cíli ta právě dokončená. */
  readonly theme: MapThemeId;
}

export interface MapStepResult {
  readonly progress: MapProgress;
  readonly move: MapMove;
}

/**
 * Plná řada: značka jde o krok dál. Ze cíle začne nová mapa a značka
 * udělá 1. krok ze startu. V cíli se přičte dokončená mapa.
 */
export function stepOnMap(progress: MapProgress): MapStepResult {
  const from = progress.step >= MAP_STEPS ? 0 : progress.step;
  const to = from + 1;
  const reachedGoal = to === MAP_STEPS;
  // Mapa se určí před přičtením dokončené mapy, v cíli je vidět ta dokončená.
  const theme = mapThemeFor(progress.completedMaps);
  return {
    progress: {
      step: to,
      completedMaps: reachedGoal ? progress.completedMaps + 1 : progress.completedMaps,
    },
    move: { from, to, reachedGoal, theme },
  };
}

/** Jak dlouho je mapa s tímto krokem vidět. */
export function mapShowMs(move: MapMove): number {
  return move.reachedGoal ? MAP_GOAL_SHOW_MS : MAP_SHOW_MS;
}

/** Převede postup na text pro uložení v zařízení (tvar se 3 kroky, #133). */
export function serializeMapProgress(progress: MapProgress): string {
  return JSON.stringify({
    format: MAP_RECORD_FORMAT,
    step: progress.step,
    completedMaps: progress.completedMaps,
  });
}

/** Přečtený záznam a jestli byl ve starém tvaru z #87. */
export interface MapRecord {
  readonly progress: MapProgress;
  /** Záznam z #87 s 8 kroky, převedený na 3 kroky (#133 AC4). */
  readonly legacy: boolean;
}

function isStepUpTo(value: unknown, lastStep: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= lastStep;
}

function isMapCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/** Krok z #87 (0 až 8) na 3 kroky: 0 → 0, 1–2 → 1, 3–7 → 2, 8 → cíl (#133 AC4). */
function convertLegacyStep(step: number): number {
  if (step === 0) {
    return 0;
  }
  if (step <= 2) {
    return 1;
  }
  if (step < LEGACY_MAP_STEPS) {
    return 2;
  }
  return MAP_STEPS;
}

function stepFromRecord(record: Record<string, unknown>, legacy: boolean): number {
  if (legacy) {
    return isStepUpTo(record.step, LEGACY_MAP_STEPS) ? convertLegacyStep(record.step) : 0;
  }
  return isStepUpTo(record.step, MAP_STEPS) ? record.step : 0;
}

/** Text záznamu jako objekt, nebo `null`, když záznam chybí nebo nejde přečíst. */
function recordObject(saved: string | null | undefined): Record<string, unknown> | null {
  if (typeof saved !== 'string' || saved === '') {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Poškozený záznam je stejný případ jako chybějící.
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  return data as Record<string, unknown>;
}

/**
 * Přečte záznam mapy v novém tvaru i ve tvaru z #87, který převede na
 * 3 kroky. Chybějící nebo nečitelný záznam dá start s 0 mapami. Nesmyslný
 * krok (i neznámý tvar záznamu) dá krok 0 a počet map zůstane, nesmyslný
 * počet map dá 0 map a krok zůstane (#133 AC5). Pole navíc se ignorují.
 */
export function readMapRecord(saved: string | null | undefined): MapRecord {
  const record = recordObject(saved);
  if (record === null) {
    return { progress: START_MAP, legacy: false };
  }
  const legacy = !('format' in record);
  const knownFormat = legacy || record.format === MAP_RECORD_FORMAT;
  return {
    progress: {
      step: knownFormat ? stepFromRecord(record, legacy) : 0,
      completedMaps: isMapCount(record.completedMaps) ? record.completedMaps : 0,
    },
    legacy,
  };
}

/** Postup, se kterým hra začne (viz `readMapRecord`). */
export function parseMapProgress(saved: string | null | undefined): MapProgress {
  return readMapRecord(saved).progress;
}

/** Značka hráče na mapě: kolečko v barvě profilu s prvním písmenem přezdívky. */
export interface MapMarker {
  readonly color: string;
  /** První písmeno přezdívky, `null` u profilu bez přezdívky. */
  readonly letter: string | null;
}

export interface MarkerProfile {
  readonly nickname?: string | undefined;
  readonly color: string;
}

export function mapMarkerFor(profile: MarkerProfile): MapMarker {
  const [firstLetter] = [...(profile.nickname ?? '')];
  return { color: profile.color, letter: firstLetter ?? null };
}
