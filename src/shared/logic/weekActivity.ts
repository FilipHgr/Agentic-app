/**
 * Přehled pro rodiče (#183, od #192 v menu pro všechny hry s přehledem):
 * kolik příkladů dítě ve hře vyřešilo za posledních 7 dní a kolik z toho
 * napoprvé (bez chyby a bez nápovědy). Dny se berou podle kalendáře
 * zařízení, „dnes“ dostane každá funkce zvenku, aby šly přechody dnů
 * vyzkoušet bez skutečných hodin. Čistý TypeScript; uložení v úložišti
 * hry řeší `src/shared/storage/activityStorage.ts`.
 */

/** Den podle kalendáře zařízení ve tvaru `RRRR-MM-DD` (řadí se jako text). */
export type DayKey = string;

/** Den v týdnu od pondělí (0) do neděle (6), pořadí zkratek dnů v textech. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Přehled ukazuje 7 dní včetně dneška (AC2). */
export const OVERVIEW_DAY_COUNT = 7;

/** Víc příkladů za den se nepočítá, aby záznam nepřerostl 1 kB (AC2). */
export const MAX_SOLVED_PER_DAY = 9999;

/** Největší velikost uloženého záznamu v bajtech (AC2). */
export const MAX_ACTIVITY_RECORD_BYTES = 1024;

export interface DayActivity {
  readonly solved: number;
  /** Z toho vyřešené napoprvé; nikdy víc než `solved`. */
  readonly firstTry: number;
}

/** Vyřešené příklady podle dnů. */
export type ActivityRecord = Readonly<Record<DayKey, DayActivity>>;

export const EMPTY_ACTIVITY: ActivityRecord = {};

export interface OverviewDay extends DayActivity {
  readonly key: DayKey;
  readonly weekday: Weekday;
  readonly isToday: boolean;
}

export interface WeekOverview {
  /** 7 dní od nejstaršího po dnešek. */
  readonly days: readonly OverviewDay[];
  readonly totalSolved: number;
  readonly totalFirstTry: number;
  /** Za 7 dní žádný vyřešený příklad (AC4). */
  readonly isEmpty: boolean;
}

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** Den podle kalendáře zařízení (místní čas, ne UTC). */
export function dayKeyOf(date: Date): DayKey {
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

/** Den o `days` dní posunutý; počítá se v kalendáři, takže přechod času nevadí. */
function shiftedDay(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

/** Pondělí je 0, neděle 6 (`Date.getDay` má neděli 0). */
function weekdayOf(date: Date): Weekday {
  return ((date.getDay() + 6) % 7) as Weekday;
}

/** Existuje takový den v kalendáři (ne 30. února ani 13. měsíc)? */
export function isCalendarDay(key: string): boolean {
  const match = DAY_KEY_PATTERN.exec(key);
  if (match === null) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return dayKeyOf(date) === key;
}

function isCount(value: unknown): value is number {
  return (
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SOLVED_PER_DAY
  );
}

/** Jeden den ze záznamu `[vyřešeno, napoprvé]`, nebo `null`, když je poškozený. */
function parseDay(value: unknown): DayActivity | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [solved, firstTry] = value as unknown[];
  if (!isCount(solved) || !isCount(firstTry) || firstTry > solved) {
    return null;
  }
  return { solved, firstTry };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Uložený záznam. Chybějící nebo poškozený záznam (i jediný špatný den)
 * je prázdný přehled (AC6); dny se tu ještě neořezávají podle dneška.
 */
export function parseActivity(saved: string | null | undefined): ActivityRecord {
  if (typeof saved !== 'string' || saved === '') {
    return EMPTY_ACTIVITY;
  }
  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Poškozený záznam je stejný případ jako chybějící.
    return EMPTY_ACTIVITY;
  }
  if (!isObject(data) || !isObject(data.days)) {
    return EMPTY_ACTIVITY;
  }
  const record: Record<DayKey, DayActivity> = {};
  for (const [key, value] of Object.entries(data.days)) {
    const day = parseDay(value);
    if (!isCalendarDay(key) || day === null) {
      return EMPTY_ACTIVITY;
    }
    record[key] = day;
  }
  return record;
}

/** Záznam jako text pro uložení: `{"days":{"2026-11-22":[12,8]}}`. */
export function serializeActivity(record: ActivityRecord): string {
  const days: Record<DayKey, [number, number]> = {};
  for (const key of Object.keys(record).sort()) {
    const day = record[key];
    if (day !== undefined) {
      days[key] = [day.solved, day.firstTry];
    }
  }
  return JSON.stringify({ days });
}

/** Klíče 7 dní přehledu od nejstaršího po dnešek. */
export function overviewDayKeys(today: Date): DayKey[] {
  return Array.from({ length: OVERVIEW_DAY_COUNT }, (_, index) =>
    dayKeyOf(shiftedDay(today, index - (OVERVIEW_DAY_COUNT - 1))),
  );
}

/**
 * Vyřešený příklad se přičte k dnešku, napoprvé i do druhého počtu (AC1).
 * Dny starší než 7 dní a dny z budoucnosti (hodiny šly pozpátku) se při
 * zápisu zahodí (AC2, AC6). Nad nejvyšší počet za den se nepřičítá.
 */
export function recordSolvedProblem(
  record: ActivityRecord,
  today: Date,
  firstTry: boolean,
): ActivityRecord {
  const kept = new Set(overviewDayKeys(today));
  const result: Record<DayKey, DayActivity> = {};
  for (const [key, day] of Object.entries(record)) {
    if (kept.has(key)) {
      result[key] = day;
    }
  }
  const todayKey = dayKeyOf(today);
  const current = result[todayKey] ?? { solved: 0, firstTry: 0 };
  if (current.solved < MAX_SOLVED_PER_DAY) {
    result[todayKey] = {
      solved: current.solved + 1,
      firstTry: current.firstTry + (firstTry ? 1 : 0),
    };
  }
  return result;
}

/**
 * Přehled 7 dní včetně dneška: dny bez hraní mají 0, starší dny a dny
 * z budoucnosti se nezapočítají (AC2, AC6).
 */
export function weekOverview(record: ActivityRecord, today: Date): WeekOverview {
  const days = Array.from({ length: OVERVIEW_DAY_COUNT }, (_, index): OverviewDay => {
    const date = shiftedDay(today, index - (OVERVIEW_DAY_COUNT - 1));
    const key = dayKeyOf(date);
    const day = record[key] ?? { solved: 0, firstTry: 0 };
    return {
      key,
      weekday: weekdayOf(date),
      isToday: index === OVERVIEW_DAY_COUNT - 1,
      solved: day.solved,
      firstTry: day.firstTry,
    };
  });
  const totalSolved = days.reduce((sum, day) => sum + day.solved, 0);
  const totalFirstTry = days.reduce((sum, day) => sum + day.firstTry, 0);
  return { days, totalSolved, totalFirstTry, isEmpty: totalSolved === 0 };
}
