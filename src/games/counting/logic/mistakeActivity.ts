/**
 * Kde se dítě plete (#184): podíl příkladů napoprvé zvlášť pro sčítání
 * a odčítání, příklady s nejvíc chybami a kolikrát dítě ťuklo na nápovědu,
 * vše za posledních 7 dní. Je to samostatný záznam vedle přehledu
 * vyřešených příkladů (#183), aby každý hlídal svou velikost. „Dnes“
 * dostane každá funkce zvenku. Čistý TypeScript; uložení řeší
 * `src/games/counting/storage/mistakeStorage.ts`.
 */

import type { Problem } from './problems';
import { MAX_NUMBER_OPTIONS } from './settings';
import type { Operation } from './settings';
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

/** Největší číslo, které se v příkladu může objevit (nejvyšší rozsah nastavení). */
const MAX_PROBLEM_NUMBER = Math.max(...MAX_NUMBER_OPTIONS);

/** Druhy příkladů v pořadí, v jakém je přehled ukazuje. */
const OPERATIONS: readonly Operation[] = ['plus', 'minus'];

/** Kolik příkladů jednoho druhu dítě vyřešilo a kolik z nich napoprvé. */
export interface OperationTally {
  readonly solved: number;
  /** Nikdy víc než `solved`. */
  readonly firstTry: number;
}

/** Příklad bez výsledku (výsledek z čísel vyplývá) a kolik v něm bylo chyb. */
export interface MistakenProblem {
  readonly first: number;
  readonly second: number;
  readonly operation: Operation;
  readonly mistakes: number;
}

export interface DayMistakes {
  readonly plus: OperationTally;
  readonly minus: OperationTally;
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

const EMPTY_DAY: DayMistakes = { plus: EMPTY_TALLY, minus: EMPTY_TALLY, hints: 0, problems: [] };

/** Podíl napoprvé jednoho druhu za 7 dní; `percent` je zaokrouhlený dolů. */
export interface OperationShare extends OperationTally {
  readonly operation: Operation;
  readonly percent: number;
}

export interface MistakeOverview {
  /** Jen druhy, které dítě za 7 dní hrálo, sčítání první (AC2). */
  readonly operations: readonly OperationShare[];
  /** Nejvýš 3 příklady s aspoň 2 chybami, od nejvíc chyb (AC3). */
  readonly frequent: readonly MistakenProblem[];
  /** Ťuknutí na nápovědu za 7 dní (AC5). */
  readonly hintsUsed: number;
}

// ---------------------------------------------------------------------------
// Čtení a zápis záznamu
// ---------------------------------------------------------------------------

/** Příklad v záznamu: „8+5“ nebo „9-3“, čísla bez úvodních nul. */
const PROBLEM_KEY_PATTERN = /^(0|[1-9]\d?)([+-])(0|[1-9]\d?)$/;

function problemKey(problem: Pick<Problem, 'first' | 'second' | 'operation'>): string {
  const sign = problem.operation === 'plus' ? '+' : '-';
  return `${problem.first}${sign}${problem.second}`;
}

/** Jde takový příklad v Počítání dostat (čísla i výsledek nejvýš do nejvyššího rozsahu)? */
function isPossibleProblem(first: number, second: number, operation: Operation): boolean {
  if (first > MAX_PROBLEM_NUMBER || second > MAX_PROBLEM_NUMBER) {
    return false;
  }
  return operation === 'plus' ? first + second <= MAX_PROBLEM_NUMBER : second <= first;
}

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

function parseMistakenProblem(value: unknown): MistakenProblem | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [key, mistakes] = value as unknown[];
  const match = typeof key === 'string' ? PROBLEM_KEY_PATTERN.exec(key) : null;
  if (match === null || !isCountUpTo(mistakes, MAX_MISTAKES_PER_PROBLEM) || mistakes === 0) {
    return null;
  }
  const first = Number(match[1]);
  const second = Number(match[3]);
  const operation: Operation = match[2] === '+' ? 'plus' : 'minus';
  if (!isPossibleProblem(first, second, operation)) {
    return null;
  }
  return { first, second, operation, mistakes };
}

function parseProblems(value: unknown): MistakenProblem[] | null {
  if (!Array.isArray(value) || value.length > MAX_MISTAKEN_PROBLEMS_PER_DAY) {
    return null;
  }
  const problems: MistakenProblem[] = [];
  const seen = new Set<string>();
  for (const item of value as unknown[]) {
    const problem = parseMistakenProblem(item);
    if (problem === null || seen.has(problemKey(problem))) {
      return null;
    }
    seen.add(problemKey(problem));
    problems.push(problem);
  }
  return problems;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Jeden den `{"p":[…],"m":[…],"h":…,"w":[…]}`, nebo `null`, když je poškozený. */
function parseDay(value: unknown): DayMistakes | null {
  if (!isObject(value)) {
    return null;
  }
  const plus = parseTally(value.p);
  const minus = parseTally(value.m);
  const problems = parseProblems(value.w);
  if (plus === null || minus === null || problems === null) {
    return null;
  }
  if (!isCountUpTo(value.h, MAX_SOLVED_PER_DAY)) {
    return null;
  }
  return { plus, minus, hints: value.h, problems };
}

/**
 * Uložený záznam. Chybějící nebo poškozený záznam (i jediný špatný den)
 * je prázdný přehled (AC6), stejně jako záznam delší než 4 kB nebo s víc
 * než 7 dny: hra takový nikdy nezapíše. Dny se tu ještě neořezávají podle
 * dneška.
 */
export function parseMistakes(saved: string | null | undefined): MistakeRecord {
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
    const day = parseDay(value);
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
    if (day !== undefined) {
      days[key] = {
        p: [day.plus.solved, day.plus.firstTry],
        m: [day.minus.solved, day.minus.firstTry],
        h: day.hints,
        w: day.problems.map((problem) => [problemKey(problem), problem.mistakes]),
      };
    }
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
  result[todayKey] = change(result[todayKey] ?? EMPTY_DAY);
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
 * Potvrzená špatná odpověď u příkladu `problem` (AC1). Příklad se posune
 * na konec dne (poslední chyba rozhoduje při shodě, AC3). Když má den už
 * 30 jiných příkladů, jeden se zahodí (AC6).
 */
export function recordMistake(record: MistakeRecord, today: Date, problem: Problem): MistakeRecord {
  return withToday(record, today, (day) => {
    const key = problemKey(problem);
    const previous = day.problems.find((item) => problemKey(item) === key);
    let others = day.problems.filter((item) => problemKey(item) !== key);
    if (previous === undefined && others.length >= MAX_MISTAKEN_PROBLEMS_PER_DAY) {
      const evict = indexToEvict(others);
      others = others.filter((_, index) => index !== evict);
    }
    const mistakes = Math.min((previous?.mistakes ?? 0) + 1, MAX_MISTAKES_PER_PROBLEM);
    const updated: MistakenProblem = {
      first: problem.first,
      second: problem.second,
      operation: problem.operation,
      mistakes,
    };
    return { ...day, problems: [...others, updated] };
  });
}

/** Vyřešený příklad druhu `operation`; napoprvé je bez chyby a bez nápovědy (AC2). */
export function recordSolvedOperation(
  record: MistakeRecord,
  today: Date,
  operation: Operation,
  firstTry: boolean,
): MistakeRecord {
  return withToday(record, today, (day) => {
    const tally = day[operation];
    if (tally.solved >= MAX_SOLVED_PER_DAY) {
      return day;
    }
    const counted = { solved: tally.solved + 1, firstTry: tally.firstTry + (firstTry ? 1 : 0) };
    return { ...day, [operation]: counted };
  });
}

/** Ťuknutí na tlačítko nápovědy (AC5). */
export function recordHintUsed(record: MistakeRecord, today: Date): MistakeRecord {
  return withToday(record, today, (day) => ({
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
      const key = problemKey(problem);
      const mistakes = (totals.get(key)?.problem.mistakes ?? 0) + problem.mistakes;
      totals.set(key, { problem: { ...problem, mistakes }, lastMistake: order });
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

function operationShares(days: readonly DayMistakes[]): OperationShare[] {
  return OPERATIONS.map((operation): OperationShare => {
    const solved = days.reduce((sum, day) => sum + day[operation].solved, 0);
    const firstTry = days.reduce((sum, day) => sum + day[operation].firstTry, 0);
    const percent = solved === 0 ? 0 : Math.floor((100 * firstTry) / solved);
    return { operation, solved, firstTry, percent };
  }).filter((share) => share.solved > 0);
}

/**
 * Přehled chyb za 7 dní včetně dneška; starší dny a dny z budoucnosti se
 * nezapočítají (AC6).
 */
export function mistakeOverview(record: MistakeRecord, today: Date): MistakeOverview {
  const days = overviewDayKeys(today)
    .map((key) => record[key])
    .filter((day): day is DayMistakes => day !== undefined);
  const totals = problemTotals(days);
  const operations = operationShares(days);
  const hintsUsed = days.reduce((sum, day) => sum + day.hints, 0);
  return {
    operations,
    frequent: frequentMistakes(totals),
    hintsUsed,
  };
}
