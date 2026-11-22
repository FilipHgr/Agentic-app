/**
 * Kde se dítě plete (#184, od #192 v menu pro všechny hry s přehledem):
 * podíl příkladů napoprvé zvlášť pro druhy příkladů hry (Počítání:
 * sčítání a odčítání), příklady s nejvíc chybami a kolikrát dítě ťuklo na
 * nápovědu, vše za posledních 7 dní. Je to samostatný záznam vedle
 * přehledu vyřešených příkladů (#183), aby každý hlídal svou velikost.
 * Příklady jsou krátké texty ze `overviewProblems.ts`; které smí v záznamu
 * být, říká popis přehledu hry (`GameOverviewSpec`). „Dnes“ dostane každá
 * funkce zvenku. Čistý TypeScript; uložení řeší
 * `src/shared/storage/activityStorage.ts`.
 */

import { isProblemOf } from './overviewProblems';
import type { GameOverviewSpec, OverviewOperation } from './overviewProblems';
import {
  MAX_SOLVED_PER_DAY,
  OVERVIEW_DAY_COUNT,
  dayKeyOf,
  isCalendarDay,
  overviewDayKeys,
} from './weekActivity';
import type { DayKey } from './weekActivity';

/** Za den se pamatuje nejvýš tolik různých příkladů s chybou (AC6). */
export const MAX_MISTAKEN_PROBLEMS_PER_DAY = 30;

/** Víc chyb u jednoho příkladu za den se nepočítá, aby záznam nepřerostl (AC6). */
export const MAX_MISTAKES_PER_PROBLEM = 99;

/** Největší velikost uloženého záznamu v bajtech (AC6). */
export const MAX_MISTAKE_RECORD_BYTES = 4096;

/** Častá chyba je příklad s aspoň tolika chybami za 7 dní (AC3). */
export const MIN_FREQUENT_MISTAKES = 2;

/** Přehled ukáže nejvýš tolik častých chyb (AC3). */
export const MAX_FREQUENT_MISTAKES = 3;

/** Klíč počtů druhu příkladu v uloženém dni. */
const TALLY_KEYS: Readonly<Record<OverviewOperation, string>> = { plus: 'p', minus: 'm' };

/** Kolik příkladů jednoho druhu dítě vyřešilo a kolik z nich napoprvé. */
export interface OperationTally {
  readonly solved: number;
  /** Nikdy víc než `solved`. */
  readonly firstTry: number;
}

/** Příklad (text z `overviewProblems.ts`, třeba „8+5“) a kolik v něm bylo chyb. */
export interface MistakenProblem {
  readonly problem: string;
  readonly mistakes: number;
}

export interface DayMistakes {
  /** Počty podle druhů příkladů hry (`GameOverviewSpec.operations`), každý druh hry má svůj. */
  readonly operations: Readonly<Partial<Record<OverviewOperation, OperationTally>>>;
  /** Kolikrát dítě ťuklo na tlačítko nápovědy. */
  readonly hints: number;
  /**
   * Příklady s chybou seřazené podle poslední chyby, nejnovější na konci;
   * nejvýš `MAX_MISTAKEN_PROBLEMS_PER_DAY`.
   */
  readonly problems: readonly MistakenProblem[];
}

/** Chyby podle dnů. */
export type MistakeRecord = Readonly<Record<DayKey, DayMistakes>>;

export const EMPTY_MISTAKES: MistakeRecord = {};

const EMPTY_TALLY: OperationTally = { solved: 0, firstTry: 0 };

/** Den bez hraní: nuly u každého druhu příkladů hry. */
function emptyDay(spec: GameOverviewSpec): DayMistakes {
  const operations: Partial<Record<OverviewOperation, OperationTally>> = {};
  for (const operation of spec.operations) {
    operations[operation] = EMPTY_TALLY;
  }
  return { operations, hints: 0, problems: [] };
}

/** Podíl napoprvé jednoho druhu za 7 dní; `percent` je zaokrouhlený dolů. */
export interface OperationShare extends OperationTally {
  readonly operation: OverviewOperation;
  readonly percent: number;
}

export interface MistakeOverview {
  /** Jen druhy, které dítě za 7 dní hrálo, v pořadí popisu hry (AC2). */
  readonly operations: readonly OperationShare[];
  /** Nejvýš 3 příklady s aspoň 2 chybami, od nejvíc chyb (AC3). */
  readonly frequent: readonly MistakenProblem[];
  /** Ťuknutí na nápovědu za 7 dní (AC5). */
  readonly hintsUsed: number;
}

// ---------------------------------------------------------------------------
// Čtení a zápis záznamu
// ---------------------------------------------------------------------------

function isCountUpTo(value: unknown, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
}

function parseTally(value: unknown): OperationTally | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [solved, firstTry] = value as unknown[];
  if (
    !isCountUpTo(solved, MAX_SOLVED_PER_DAY) ||
    !isCountUpTo(firstTry, MAX_SOLVED_PER_DAY) ||
    firstTry > solved
  ) {
    return null;
  }
  return { solved, firstTry };
}

function parseMistakenProblem(value: unknown, spec: GameOverviewSpec): MistakenProblem | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [problem, mistakes] = value as unknown[];
  if (
    typeof problem !== 'string' ||
    !isProblemOf(problem, spec) ||
    !isCountUpTo(mistakes, MAX_MISTAKES_PER_PROBLEM) ||
    mistakes === 0
  ) {
    return null;
  }
  return { problem, mistakes };
}

function parseProblems(value: unknown, spec: GameOverviewSpec): MistakenProblem[] | null {
  if (!Array.isArray(value) || value.length > MAX_MISTAKEN_PROBLEMS_PER_DAY) {
    return null;
  }
  const problems: MistakenProblem[] = [];
  const seen = new Set<string>();
  for (const item of value as unknown[]) {
    const problem = parseMistakenProblem(item, spec);
    if (problem === null || seen.has(problem.problem)) {
      return null;
    }
    seen.add(problem.problem);
    problems.push(problem);
  }
  return problems;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Jeden den `{"p":[…],"m":[…],"h":…,"w":[…]}` (počty `p` a `m` jen u her,
 * které ty druhy příkladů mají), nebo `null`, když je poškozený.
 */
function parseDay(value: unknown, spec: GameOverviewSpec): DayMistakes | null {
  if (!isObject(value)) {
    return null;
  }
  const operations: Partial<Record<OverviewOperation, OperationTally>> = {};
  for (const operation of spec.operations) {
    const tally = parseTally(value[TALLY_KEYS[operation]]);
    if (tally === null) {
      return null;
    }
    operations[operation] = tally;
  }
  const problems = parseProblems(value.w, spec);
  if (problems === null || !isCountUpTo(value.h, MAX_SOLVED_PER_DAY)) {
    return null;
  }
  return { operations, hints: value.h, problems };
}

/**
 * Uložený záznam hry s popisem `spec`. Chybějící nebo poškozený záznam (i
 * jediný špatný den nebo příklad, který hra nemůže dát) je prázdný přehled
 * (AC6), stejně jako záznam delší než 4 kB nebo s víc než 7 dny: hra
 * takový nikdy nezapíše. Dny se tu ještě neořezávají podle dneška.
 */
export function parseMistakes(
  saved: string | null | undefined,
  spec: GameOverviewSpec,
): MistakeRecord {
  if (typeof saved !== 'string' || saved === '') {
    return EMPTY_MISTAKES;
  }
  if (new TextEncoder().encode(saved).length > MAX_MISTAKE_RECORD_BYTES) {
    return EMPTY_MISTAKES;
  }
  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Poškozený záznam je stejný případ jako chybějící.
    return EMPTY_MISTAKES;
  }
  if (!isObject(data) || !isObject(data.days)) {
    return EMPTY_MISTAKES;
  }
  if (Object.keys(data.days).length > OVERVIEW_DAY_COUNT) {
    return EMPTY_MISTAKES;
  }
  const record: Record<DayKey, DayMistakes> = {};
  for (const [key, value] of Object.entries(data.days)) {
    const day = parseDay(value, spec);
    if (!isCalendarDay(key) || day === null) {
      return EMPTY_MISTAKES;
    }
    record[key] = day;
  }
  return record;
}

/**
 * Záznam jako text pro uložení, co nejkratší:
 * `{"days":{"2026-11-22":{"p":[12,8],"m":[0,0],"h":1,"w":[["8+5",3]]}}}`.
 */
export function serializeMistakes(record: MistakeRecord): string {
  const days: Record<DayKey, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const day = record[key];
    if (day === undefined) {
      continue;
    }
    const saved: Record<string, unknown> = {};
    for (const operation of ['plus', 'minus'] as const) {
      const tally = day.operations[operation];
      if (tally !== undefined) {
        saved[TALLY_KEYS[operation]] = [tally.solved, tally.firstTry];
      }
    }
    saved.h = day.hints;
    saved.w = day.problems.map((problem) => [problem.problem, problem.mistakes]);
    days[key] = saved;
  }
  return JSON.stringify({ days });
}

// ---------------------------------------------------------------------------
// Zápis událostí ze hry
// ---------------------------------------------------------------------------

/**
 * Záznam, ve kterém se dnešní den změní funkcí `change`. Dny starší než
 * 7 dní a dny z budoucnosti (hodiny šly pozpátku) se zahodí (AC6).
 */
function withToday(
  record: MistakeRecord,
  today: Date,
  spec: GameOverviewSpec,
  change: (day: DayMistakes) => DayMistakes,
): MistakeRecord {
  const kept = new Set(overviewDayKeys(today));
  const result: Record<DayKey, DayMistakes> = {};
  for (const [key, day] of Object.entries(record)) {
    if (kept.has(key)) {
      result[key] = day;
    }
  }
  const todayKey = dayKeyOf(today);
  result[todayKey] = change(result[todayKey] ?? emptyDay(spec));
  return result;
}

/**
 * Index příkladu, který udělá místo novému, když je den plný: ten s nejméně
 * chybami, při shodě ten s nejstarší poslední chybou (je dřív v seznamu).
 */
function indexToEvict(problems: readonly MistakenProblem[]): number {
  let evict = 0;
  problems.forEach((problem, index) => {
    if (problem.mistakes < (problems[evict]?.mistakes ?? Infinity)) {
      evict = index;
    }
  });
  return evict;
}

/**
 * Potvrzená špatná odpověď u příkladu `problem` (AC1, text
 * z `overviewProblems.ts`). Příklad se posune na konec dne (poslední chyba
 * rozhoduje při shodě, AC3). Když má den už 30 jiných příkladů, jeden se
 * zahodí (AC6). Příklad, který do záznamu hry nepatří, nic nezmění.
 */
export function recordMistake(
  record: MistakeRecord,
  today: Date,
  problem: string,
  spec: GameOverviewSpec,
): MistakeRecord {
  if (!isProblemOf(problem, spec)) {
    return record;
  }
  return withToday(record, today, spec, (day) => {
    const previous = day.problems.find((item) => item.problem === problem);
    let others = day.problems.filter((item) => item.problem !== problem);
    if (previous === undefined && others.length >= MAX_MISTAKEN_PROBLEMS_PER_DAY) {
      const evict = indexToEvict(others);
      others = others.filter((_, index) => index !== evict);
    }
    const mistakes = Math.min((previous?.mistakes ?? 0) + 1, MAX_MISTAKES_PER_PROBLEM);
    return { ...day, problems: [...others, { problem, mistakes }] };
  });
}

/**
 * Vyřešený příklad druhu `operation`; napoprvé je bez chyby a bez nápovědy
 * (AC2). Druh, který hra v popisu nemá, nic nezmění.
 */
export function recordSolvedOperation(
  record: MistakeRecord,
  today: Date,
  operation: OverviewOperation,
  firstTry: boolean,
  spec: GameOverviewSpec,
): MistakeRecord {
  if (!spec.operations.includes(operation)) {
    return record;
  }
  return withToday(record, today, spec, (day) => {
    const tally = day.operations[operation] ?? EMPTY_TALLY;
    if (tally.solved >= MAX_SOLVED_PER_DAY) {
      return day;
    }
    const counted = { solved: tally.solved + 1, firstTry: tally.firstTry + (firstTry ? 1 : 0) };
    return { ...day, operations: { ...day.operations, [operation]: counted } };
  });
}

/** Ťuknutí na tlačítko nápovědy (AC5). */
export function recordHintUsed(
  record: MistakeRecord,
  today: Date,
  spec: GameOverviewSpec,
): MistakeRecord {
  return withToday(record, today, spec, (day) => ({
    ...day,
    hints: Math.min(day.hints + 1, MAX_SOLVED_PER_DAY),
  }));
}

// ---------------------------------------------------------------------------
// Přehled za 7 dní
// ---------------------------------------------------------------------------

interface ProblemTotal {
  readonly problem: MistakenProblem;
  /** Pořadí poslední chyby přes všechny dny; větší je novější. */
  readonly lastMistake: number;
}

/** Chyby u stejného příkladu ze všech dnů sečtené, s pořadím poslední chyby. */
function problemTotals(days: readonly DayMistakes[]): ProblemTotal[] {
  const totals = new Map<string, ProblemTotal>();
  let order = 0;
  for (const day of days) {
    for (const problem of day.problems) {
      const mistakes = (totals.get(problem.problem)?.problem.mistakes ?? 0) + problem.mistakes;
      totals.set(problem.problem, { problem: { ...problem, mistakes }, lastMistake: order });
      order += 1;
    }
  }
  return [...totals.values()];
}

/** Nejvíc chyb první, při shodě novější poslední chyba (AC3). */
function frequentMistakes(totals: readonly ProblemTotal[]): MistakenProblem[] {
  return totals
    .filter((total) => total.problem.mistakes >= MIN_FREQUENT_MISTAKES)
    .sort((a, b) => b.problem.mistakes - a.problem.mistakes || b.lastMistake - a.lastMistake)
    .slice(0, MAX_FREQUENT_MISTAKES)
    .map((total) => total.problem);
}

function operationShares(days: readonly DayMistakes[], spec: GameOverviewSpec): OperationShare[] {
  return spec.operations
    .map((operation): OperationShare => {
      const tallies = days.map((day) => day.operations[operation] ?? EMPTY_TALLY);
      const solved = tallies.reduce((sum, tally) => sum + tally.solved, 0);
      const firstTry = tallies.reduce((sum, tally) => sum + tally.firstTry, 0);
      const percent = solved === 0 ? 0 : Math.floor((100 * firstTry) / solved);
      return { operation, solved, firstTry, percent };
    })
    .filter((share) => share.solved > 0);
}

/**
 * Přehled chyb za 7 dní včetně dneška; starší dny a dny z budoucnosti se
 * nezapočítají (AC6).
 */
export function mistakeOverview(
  record: MistakeRecord,
  today: Date,
  spec: GameOverviewSpec,
): MistakeOverview {
  const days = overviewDayKeys(today)
    .map((key) => record[key])
    .filter((day): day is DayMistakes => day !== undefined);
  return {
    operations: operationShares(days, spec),
    frequent: frequentMistakes(problemTotals(days)),
    hintsUsed: days.reduce((sum, day) => sum + day.hints, 0),
  };
}
