/**
 * Náhodné řady s pevným seedem pro testy Omalovánek, aby dopadly pokaždé
 * stejně. Do #148 byly v pomůckách nedávných barev (`recentColorsHelpers.ts`).
 */

/**
 * Generátor čísel v [0, 1) s pevným seedem (mulberry32), aby náhodné řady
 * ťuknutí dopadly pokaždé stejně.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Celé číslo v [0, `count`) z generátoru `random`. */
export function pick(random: () => number, count: number): number {
  return Math.floor(random() * count);
}
