/**
 * Vstup stránky (#67): stránka začíná v menu s výběrem her. Hra se
 * stáhne a spustí až po ťuknutí na její dlaždici. Profily dětí (#71) se
 * otevřou jednou za načtení stránky, dřív než menu: při prvním spuštění
 * po aktualizaci se tím přenesou dnešní data do výchozího profilu.
 * Záznamy her (#125, album Omalovánek) jsou jen v zařízení v IndexedDB.
 */

import { GAMES } from './gameList';
import { registerGameImport } from './menu/ui/gameImport';
import { startMenuPage } from './menu/ui/menuPage';
import { GAME_CATEGORIES } from './shared/logic/gameRegistry';
import { blockInstallOffer } from './shared/logic/installOffer';
import { browserIndexedDb, indexedDbProfileRecords } from './shared/storage/indexedDbRecords';
import { browserStorage } from './shared/storage/keyValueStorage';
import { openProfiles } from './shared/storage/profileStorage';

// Chrome nesmí dítěti sám nabídnout instalaci, v menu ani ve hře (#78).
blockInstallOffer(window);
// Dřív než menu: menu může hru začít stahovat hned po prvním ťuknutí.
registerGameImport();
startMenuPage({
  games: GAMES,
  categories: GAME_CATEGORIES,
  profiles: openProfiles(
    browserStorage(),
    indexedDbProfileRecords(browserIndexedDb(), { persistentStorage: navigator.storage }),
  ),
});
