/**
 * Načítání vlajek jazyků jednou za život stránky (#172). Menu i výběr
 * profilu běží v jedné hře Phaseru a sdílí textury; obě scény se rozbíhají
 * zároveň, takže kontrola „textura už existuje“ nestačí: vlajka, kterou
 * druhá scéna právě stahuje, ještě neexistuje. Záznam si proto pamatuje
 * i vlajky, které se už stahují. Čistý TypeScript bez Phaseru.
 */

/**
 * Co má scéna s vlajkou udělat:
 * - `load`: nikdo ji ještě nestahuje, stáhne ji tato scéna,
 * - `wait`: už se stahuje (nebo se stáhnout nepodařilo), znovu se nestahuje,
 * - `loaded`: textura už je, stačí ji použít.
 */
export type FlagLoadDecision = 'load' | 'wait' | 'loaded';

export interface FlagLoads {
  /** Rozhodne o vlajce s klíčem `key`; `load` vrátí pro každý klíč nejvýš jednou. */
  decide(key: string, textureExists: boolean): FlagLoadDecision;
}

export function createFlagLoads(): FlagLoads {
  const requested = new Set<string>();
  return {
    decide(key, textureExists) {
      if (textureExists) {
        return 'loaded';
      }
      if (requested.has(key)) {
        return 'wait';
      }
      requested.add(key);
      return 'load';
    },
  };
}
