/**
 * Počítání teček ťukáním v nápovědě (#43): dítě ťuká na tečky jednu po
 * druhé a každá dostane číslo podle pořadí ťuknutí. Počítání není odpověď,
 * kolo jen čte. Čistý TypeScript bez Phaseru.
 */

import { hintCrossedOutDots, hintDotGroups, isHintVisible } from './answerRound';
import type { AnswerRound } from './answerRound';
import type { Tone } from './answerSounds';
import type { Problem } from './problems';

export interface DotCounting {
  /** Číslo každé tečky v pořadí nápovědy (i přeškrtnuté); `null` = nespočítaná. */
  readonly numbers: readonly (number | null)[];
}

export interface DotCountResult {
  readonly counting: DotCounting;
  /** Číslo, které tečka právě dostala; `null` = nic se nestalo a tón nehraje. */
  readonly countedNumber: number | null;
}

/** Při rozsahu 20 jsou tečky moc husté na plochy pro prst, ťukat jde jen u 5 a 10. */
export function canCountDots(maxNumber: number): boolean {
  return maxNumber === 5 || maxNumber === 10;
}

/** Nápověda nového příkladu: žádná tečka zatím nemá číslo. */
export function startDotCounting(problem: Problem): DotCounting {
  const dotCount = hintDotGroups(problem).reduce((sum, count) => sum + count, 0);
  return { numbers: Array.from({ length: dotCount }, () => null) };
}

/** Kolik teček už dítě spočítalo. */
export function countedDotCount(counting: DotCounting): number {
  return counting.numbers.filter((number) => number !== null).length;
}

/**
 * Ťuknutí na tečku `dotIndex`. Tečka dostane další číslo v pořadí, pokud
 * jde počítat: nápověda je vidět, rozsah je 5 nebo 10, tečka není
 * přeškrtnutá a ještě číslo nemá. Jinak se nic nestane.
 */
export function countDot(
  round: AnswerRound,
  counting: DotCounting,
  dotIndex: number,
): DotCountResult {
  const unchanged = { counting, countedNumber: null };
  if (!canCountDots(round.maxNumber) || !isHintVisible(round)) {
    return unchanged;
  }

  const countableDots = counting.numbers.length - hintCrossedOutDots(round.problem);
  if (!Number.isInteger(dotIndex) || dotIndex < 0 || dotIndex >= countableDots) {
    return unchanged;
  }
  if (counting.numbers[dotIndex] !== null) {
    return unchanged;
  }

  const countedNumber = countedDotCount(counting) + 1;
  const numbers = counting.numbers.map((number, index) =>
    index === dotIndex ? countedNumber : number,
  );
  return { counting: { numbers }, countedNumber };
}

/**
 * Tóny durové stupnice od C5 do E6. Každá další tečka zní o stupeň výš;
 * E6 je nejvyšší tón oslavy, výš se nejde.
 */
const COUNTING_FREQUENCIES_HZ = [
  523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51,
];

const COUNTING_TONE_SECONDS = 0.12;
const COUNTING_TONE_VOLUME = 0.3;

/** Krátký tón pro tečku s číslem `count` (1 = první spočítaná). */
export function countingTone(count: number): Tone {
  const lastIndex = COUNTING_FREQUENCIES_HZ.length - 1;
  const index = Math.min(Math.max(Math.floor(count) - 1, 0), lastIndex);
  return {
    frequencyHz: COUNTING_FREQUENCIES_HZ[index] ?? COUNTING_FREQUENCIES_HZ[lastIndex] ?? 1318.51,
    startSeconds: 0,
    durationSeconds: COUNTING_TONE_SECONDS,
    volume: COUNTING_TONE_VOLUME,
  };
}
