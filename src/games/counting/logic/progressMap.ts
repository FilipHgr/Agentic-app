/**
 * Mapa postupu v Počítání (#87): za každou plnou řadu hvězdiček jde
 * značka hráče o krok dál. Mapa má 8 kroků, krok 0 je start a krok 8 cíl.
 * Po cíli začne další plná řada novou mapu. Jen dopředu, nic se nebere.
 * Čistý TypeScript bez Phaseru; uložení řeší
 * `src/games/counting/storage/mapStorage.ts`, rozmístění míst
 * `progressMapLayout.ts` a kreslení scéna.
 */

/** Kolik kroků (plných řad) je od startu do cíle. */
export const MAP_STEPS = 8;

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
  return {
    progress: {
      step: to,
      completedMaps: reachedGoal ? progress.completedMaps + 1 : progress.completedMaps,
    },
    move: { from, to, reachedGoal },
  };
}

/** Jak dlouho je mapa s tímto krokem vidět. */
export function mapShowMs(move: MapMove): number {
  return move.reachedGoal ? MAP_GOAL_SHOW_MS : MAP_SHOW_MS;
}

/** Převede postup na text pro uložení v zařízení. */
export function serializeMapProgress(progress: MapProgress): string {
  return JSON.stringify({ step: progress.step, completedMaps: progress.completedMaps });
}

function isStep(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAP_STEPS;
}

function isMapCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/**
 * Postup, se kterým hra začne. Chybějící nebo nečitelný záznam dá start
 * s 0 mapami. Nesmyslný krok dá krok 0 a počet map zůstane, nesmyslný
 * počet map dá 0 map a krok zůstane (#87 AC6). Pole navíc se ignorují.
 */
export function parseMapProgress(saved: string | null | undefined): MapProgress {
  if (typeof saved !== 'string' || saved === '') {
    return START_MAP;
  }

  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Poškozený záznam je stejný případ jako chybějící.
    return START_MAP;
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return START_MAP;
  }

  const record = data as Record<string, unknown>;
  return {
    step: isStep(record.step) ? record.step : 0,
    completedMaps: isMapCount(record.completedMaps) ? record.completedMaps : 0,
  };
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
