/**
 * Profil dítěte (#71): stálé vnitřní označení, přezdívka (smí chybět,
 * nemusí být skutečné jméno) a barva z pevné palety. Nic dalšího profil
 * nemá. Čistý TypeScript bez prohlížeče.
 */

/**
 * Paleta barev profilů podle schváleného obrázku (#71): bílé písmeno má
 * proti každé barvě kontrast aspoň 3 : 1. Pořadí je předvýběr nového
 * profilu, první barvu má výchozí profil.
 */
export const PROFILE_COLORS = [
  '#E8590C',
  '#2F9E44',
  '#1C7ED6',
  '#AE3EC9',
  '#E03131',
  '#0C8599',
  '#D6336C',
  '#5F3DC4',
] as const;

export type ProfileColor = (typeof PROFILE_COLORS)[number];

export interface Profile {
  /** Stálé vnitřní označení; jen z písmen a číslic, nikdy přezdívka. */
  readonly id: string;
  readonly nickname?: string;
  readonly color: ProfileColor;
}

/**
 * Vnitřní označení výchozího profilu. Je pevné, aby nedokončený přenos
 * dnešních dat (#71) při dalším pokusu zapisoval do stejných klíčů.
 */
export const DEFAULT_PROFILE_ID = 'default';

/** Barva výchozího profilu (první barva palety). */
export const DEFAULT_PROFILE_COLOR: ProfileColor = PROFILE_COLORS[0];

/** Je hodnota barva z palety? */
export function isProfileColor(value: unknown): value is ProfileColor {
  return PROFILE_COLORS.some((color) => color === value);
}

/**
 * Vnitřní označení profilu nebo hry v klíči úložiště: neprázdné, jen malá
 * písmena bez diakritiky, číslice a pomlčka.
 */
export function isProfileId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]+$/.test(value);
}

/** Přezdívka: 1 až 12 velkých písmen (z mřížky písmen), nic jiného. */
export function isNickname(value: unknown): value is string {
  return typeof value === 'string' && /^\p{Lu}{1,12}$/u.test(value);
}

/**
 * Profil z uložených dat, nebo `null`, když data profil nejsou. Vezme
 * jen označení, přezdívku a barvu, ostatní pole přeskočí.
 */
export function parseProfile(value: unknown): Profile | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const { id, nickname, color } = record;
  if (!isProfileId(id) || !isProfileColor(color)) {
    return null;
  }
  if (nickname === undefined) {
    return { id, color };
  }
  if (!isNickname(nickname)) {
    return null;
  }
  return { id, nickname, color };
}

/** Profil jen s povolenými poli; neplatná nebo chybějící přezdívka = profil bez přezdívky. */
export function makeProfile(id: string, color: ProfileColor, nickname?: string): Profile {
  return isNickname(nickname) ? { id, nickname, color } : { id, color };
}
