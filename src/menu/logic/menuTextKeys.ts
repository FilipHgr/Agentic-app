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

/** Otázka v potvrzení smazání profilu („Smazat profil?“, #73). */
export const DELETE_QUESTION_KEY = 'profiles.deleteQuestion';

/** Červené tlačítko potvrzení smazání („Smazat“, #73). */
export const DELETE_CONFIRM_KEY = 'profiles.deleteConfirm';

/** Šedé tlačítko, které smazání zruší („Zpět“, #73). */
export const DELETE_CANCEL_KEY = 'profiles.deleteCancel';
