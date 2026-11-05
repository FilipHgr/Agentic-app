/**
 * Klíče textů, které menu potřebuje bez seznamu her (#67). Logika menu
 * (`menu.ts`) je importuje odsud, aby kvůli nim nenačítala `src/gameList.ts`.
 */

/** Klíč názvu stránky v menu („Matematika“, sdílené texty). */
export const PAGE_TITLE_KEY = 'page.title';

/** Nadpis 1. kroku formuláře nového profilu („Přezdívka“, #72). */
export const NICKNAME_TITLE_KEY = 'profiles.nicknameTitle';

/** Nadpis 2. kroku formuláře nového profilu („Barva“, #72). */
export const COLOR_TITLE_KEY = 'profiles.colorTitle';
