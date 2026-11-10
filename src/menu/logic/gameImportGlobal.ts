/**
 * Jméno globální funkce, přes kterou produkční build stahuje vstup hry
 * s novým pokusem po výpadku sítě (#67 AC5). Jediné místo pro plugin
 * `game-import-retry` (`tools/build/gameImportRetry.ts`) i pro stránku
 * (`src/menu/ui/gameImport.ts`).
 */
export const GAME_IMPORT_GLOBAL = '__agenticImportGame';
