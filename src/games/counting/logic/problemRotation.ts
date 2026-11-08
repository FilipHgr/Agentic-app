/**
 * Vystřídání příkladů (#94): každý příklad ze skupiny přijde jednou, než se
 * kterýkoli z nich zopakuje, a mezi dvěma stejnými příklady jsou aspoň
 * 4 jiné. Skupiny jsou dvě, příklady bez nuly a s nulou (#39), aby nula
 * dál chodila jen asi v `ZERO_SHARE` případů.
 *
 * Stav se nikam neukládá: nové spuštění hry začne nové vystřídání.
 * Čistý TypeScript bez Phaseru.
 */

import { ZERO_SHARE, hasZero, pickFrom, pickOperation, problemsOf } from './problems';
import type { Problem } from './problems';
import type { GameSettings, Operation } from './settings';

/** Kolik posledních příkladů se nesmí hned vrátit (AC1). */
export const RECENT_PROBLEMS_KEPT = 4;

type ProblemGroup = 'withoutZero' | 'withZero';

type UsedInGroups = Readonly<Record<ProblemGroup, ReadonlySet<string>>>;

/** Stav vystřídání; mění se jen tak, že `drawProblem` vrátí nový. */
export interface ProblemRotation {
  /** Rozsah a druh příkladů, pro které vystřídání běží; `null` před prvním příkladem. */
  readonly settingsKey: string | null;
  /** Příklady, které v aktuálním vystřídání skupiny už přišly. */
  readonly used: UsedInGroups;
  /** Poslední příklady, nejnovější na konci. */
  readonly recent: readonly string[];
}

export interface DrawnProblem {
  readonly problem: Problem;
  readonly rotation: ProblemRotation;
}

const NOTHING_USED: UsedInGroups = { withoutZero: new Set(), withZero: new Set() };

/** Pojistka, kdyby nešlo vybrat nic jiného; při rozsazích hry nenastane. */
const FALLBACK_PROBLEM: Problem = { first: 1, second: 1, operation: 'plus', result: 2 };

/** Nové vystřídání při startu hry. */
export function startProblemRotation(): ProblemRotation {
  return { settingsKey: null, used: NOTHING_USED, recent: [] };
}

/** Způsob odpovědi (číselník, psaní) příklady nemění, proto v klíči není. */
function settingsKeyOf(settings: GameSettings): string {
  return `${settings.maxNumber} ${settings.operations}`;
}

/** Stejný příklad má stejné první číslo, znaménko i druhé číslo (#37). */
function problemKey(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '-';
  return `${problem.first} ${sign} ${problem.second}`;
}

function groupOf(problem: Problem): ProblemGroup {
  return hasZero(problem) ? 'withZero' : 'withoutZero';
}

function otherGroup(group: ProblemGroup): ProblemGroup {
  return group === 'withZero' ? 'withoutZero' : 'withZero';
}

function operationsOf(settings: GameSettings): Operation[] {
  return settings.operations === 'mixed' ? ['plus', 'minus'] : [settings.operations];
}

function groupProblems(settings: GameSettings, group: ProblemGroup): Problem[] {
  return operationsOf(settings)
    .flatMap((operation) => problemsOf(operation, settings.maxNumber))
    .filter((problem) => groupOf(problem) === group);
}

interface GroupPick {
  readonly problem: Problem;
  /** Co ve vystřídání skupiny přišlo i s vybraným příkladem. */
  readonly used: ReadonlySet<string>;
}

/**
 * Vybere příklad skupiny, který ve vystřídání ještě nebyl a není mezi
 * posledními. Přednost má zvolený druh; když už žádný jeho příklad
 * nezbývá, vezme se druhý, aby se vystřídání dokončilo. Když skupině
 * nic nezbývá, začne její nové vystřídání. Vrátí `null`, když nejde
 * vybrat nic.
 */
function pickInGroup(
  problems: readonly Problem[],
  used: ReadonlySet<string>,
  recent: readonly string[],
  operation: Operation,
  random: () => number,
): GroupPick | null {
  const notYetUsed = problems.filter((problem) => !used.has(problemKey(problem)));
  const rotationIsOver = notYetUsed.length === 0;
  const usedSoFar: ReadonlySet<string> = rotationIsOver ? new Set() : used;
  const unused = rotationIsOver ? problems : notYetUsed;

  const allowed = unused.filter((problem) => !recent.includes(problemKey(problem)));
  const sameOperation = allowed.filter((problem) => problem.operation === operation);
  const problem = pickFrom(sameOperation.length > 0 ? sameOperation : allowed, random);
  if (problem === undefined) {
    return null;
  }
  return { problem, used: new Set([...usedSoFar, problemKey(problem)]) };
}

function rememberRecent(recent: readonly string[], problem: Problem): string[] {
  return [...recent, problemKey(problem)].slice(-RECENT_PROBLEMS_KEPT);
}

/**
 * Vylosuje další příklad a vrátí ho s novým stavem; `rotation` se nemění.
 * Při jiném rozsahu nebo druhu příkladů než minule začne nové vystřídání,
 * poslední příklady se ale hlídají dál (AC5). Losování vždy skončí, i když
 * generátor vrací pořád stejné číslo.
 *
 * @param random Generátor v rozsahu [0, 1), v testech lze podvrhnout.
 */
export function drawProblem(
  rotation: ProblemRotation,
  settings: GameSettings,
  random: () => number,
): DrawnProblem {
  const settingsKey = settingsKeyOf(settings);
  const used = rotation.settingsKey === settingsKey ? rotation.used : NOTHING_USED;
  const operation = pickOperation(settings, random);
  const preferredGroup: ProblemGroup = random() < ZERO_SHARE ? 'withZero' : 'withoutZero';

  for (const group of [preferredGroup, otherGroup(preferredGroup)]) {
    const pick = pickInGroup(
      groupProblems(settings, group),
      used[group],
      rotation.recent,
      operation,
      random,
    );
    if (pick !== null) {
      return {
        problem: pick.problem,
        rotation: {
          settingsKey,
          used: { ...used, [group]: pick.used },
          recent: rememberRecent(rotation.recent, pick.problem),
        },
      };
    }
  }

  return {
    problem: FALLBACK_PROBLEM,
    rotation: { settingsKey, used, recent: rememberRecent(rotation.recent, FALLBACK_PROBLEM) },
  };
}
