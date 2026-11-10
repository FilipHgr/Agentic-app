/** Pevný seed, ze kterého testy losují, aby dopadly pokaždé stejně. */
export const TEST_SEED = 20261103;

/**
 * Generátor náhodných čísel v rozsahu [0, 1) s pevným seedem (mulberry32).
 * Se stejným seedem vydá vždy stejnou řadu čísel. Každý test si má vytvořit
 * vlastní instanci, aby nezávisel na pořadí ostatních testů.
 */
export function seededRandom(seed: number = TEST_SEED): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
