/**
 * Výběr varianty repliky pandy Rudyho (#176), bez prohlížeče. Každá chvíle
 * (pozdrav, oslava…) má několik replik a ty se střídají v pevném pořadí,
 * takže stejná replika nikdy nezazní dvakrát po sobě:
 *
 * - Bez záznamu (první chvíle v profilu) zazní první varianta, tedy ta,
 *   kterou Rudy říkal před #176.
 * - Jinak zazní varianta po té, která zazněla naposledy; po poslední
 *   znovu první.
 * - Záznam, který žádnou variantu nenazývá (poškozený nebo ze starší
 *   verze hry), je jako bez záznamu: zazní první varianta.
 */

/** Varianty jedné chvíle v pořadí střídání; vždy aspoň jedna. */
export type RudyVariantList<L extends string> = readonly [L, ...L[]];

/** Varianta, která zazní příště, když naposledy zazněla `lastSaid`. */
export function nextRudyVariant<L extends string>(
  variants: RudyVariantList<L>,
  lastSaid: string | null,
): L {
  const lastIndex = variants.findIndex((variant) => variant === lastSaid);
  if (lastIndex === -1) {
    return variants[0];
  }
  return variants[(lastIndex + 1) % variants.length] ?? variants[0];
}
