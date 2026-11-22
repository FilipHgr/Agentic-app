/**
 * Záznamy pro přehled pro rodiče (#183, #184, od #192 společné pro hry
 * a čtené v menu). Hra zapisuje do svého úložiště aktivního profilu
 * (`ProfileStore.gameStorage`), menu čte stejné úložiště stejného profilu.
 * Úložiště profilu ukládá pod vnitřním označením profilu, nikdy
 * s přezdívkou, a se smazáním profilu záznamy zmizí. Klíče a tvar jsou
 * stejné jako v Počítání před #192, takže dřívější záznamy zůstanou.
 *
 * Když prohlížeč úložiště nedovolí nebo je plné, hra jede dál se záznamy
 * v paměti; žádná výjimka z úložiště neunikne.
 */

import {
  EMPTY_MISTAKES,
  mistakeOverview,
  parseMistakes,
  recordHintUsed,
  recordMistake,
  recordSolvedOperation,
  serializeMistakes,
} from '../logic/mistakeActivity';
import type { MistakeOverview, MistakeRecord } from '../logic/mistakeActivity';
import type { GameOverviewSpec, OverviewOperation } from '../logic/overviewProblems';
import {
  EMPTY_ACTIVITY,
  parseActivity,
  recordSolvedProblem,
  serializeActivity,
  weekOverview,
} from '../logic/weekActivity';
import type { ActivityRecord, WeekOverview } from '../logic/weekActivity';
import type { KeyValueStorage } from './keyValueStorage';

/** Vyřešené příklady za 7 dní (#183). */
export const ACTIVITY_KEY = 'agentic-app.activity';

/** Chyby, podíl napoprvé a nápověda za 7 dní (#184). */
export const MISTAKES_KEY = 'agentic-app.mistakes';

/** Co přehled ukáže u jedné hry. */
export interface GameOverview {
  readonly week: WeekOverview;
  readonly mistakes: MistakeOverview;
}

function readItem(storage: KeyValueStorage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return null;
  }
}

function writeItem(storage: KeyValueStorage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje se záznamem v paměti.
  }
}

/** Načte vyřešené příklady; bez úložiště nebo při chybě prázdný záznam. */
export function loadActivity(storage: KeyValueStorage | undefined): ActivityRecord {
  const saved = readItem(storage, ACTIVITY_KEY);
  return saved === null ? EMPTY_ACTIVITY : parseActivity(saved);
}

/** Načte chyby hry s popisem `spec`; bez úložiště nebo při chybě prázdný záznam. */
export function loadMistakes(
  storage: KeyValueStorage | undefined,
  spec: GameOverviewSpec,
): MistakeRecord {
  const saved = readItem(storage, MISTAKES_KEY);
  return saved === null ? EMPTY_MISTAKES : parseMistakes(saved, spec);
}

/**
 * Přehled hry za 7 dní do dneška `today` z úložiště hry aktivního profilu
 * (menu, #192). Nic nemění ani neukládá; poškozený záznam je prázdný přehled.
 */
export function readGameOverview(
  storage: KeyValueStorage | undefined,
  spec: GameOverviewSpec,
  today: Date,
): GameOverview {
  return {
    week: weekOverview(loadActivity(storage), today),
    mistakes: mistakeOverview(loadMistakes(storage, spec), today, spec),
  };
}

/** Jak hra zapisuje do přehledu; každá událost se hned uloží. */
export interface ActivityLog {
  /**
   * Vyřešený příklad; napoprvé je bez chyby a bez nápovědy. `operation`
   * jen u her, které druhy příkladů počítají zvlášť (Počítání).
   */
  solved(firstTry: boolean, operation?: OverviewOperation): void;
  /** Potvrzená špatná odpověď u příkladu `problem` (text z `overviewProblems.ts`). */
  mistake(problem: string): void;
  /** Ťuknutí na tlačítko nápovědy. */
  hintUsed(): void;
}

export interface ActivityLogOptions {
  readonly storage: KeyValueStorage | undefined;
  readonly spec: GameOverviewSpec;
  /** Dnešní datum podle kalendáře zařízení. */
  readonly today: () => Date;
}

/**
 * Záznamy jedné hry pro jedno sezení. Načtou se při vytvoření a drží se
 * v paměti, takže platí i bez úložiště do zavření stránky.
 */
export function createActivityLog(options: ActivityLogOptions): ActivityLog {
  const { storage, spec, today } = options;
  let activity = loadActivity(storage);
  let mistakes = loadMistakes(storage, spec);

  const saveMistakes = (next: MistakeRecord): void => {
    mistakes = next;
    writeItem(storage, MISTAKES_KEY, serializeMistakes(mistakes));
  };

  return {
    solved(firstTry: boolean, operation?: OverviewOperation): void {
      activity = recordSolvedProblem(activity, today(), firstTry);
      writeItem(storage, ACTIVITY_KEY, serializeActivity(activity));
      if (operation !== undefined) {
        saveMistakes(recordSolvedOperation(mistakes, today(), operation, firstTry, spec));
      }
    },
    mistake(problem: string): void {
      saveMistakes(recordMistake(mistakes, today(), problem, spec));
    },
    hintUsed(): void {
      saveMistakes(recordHintUsed(mistakes, today(), spec));
    },
  };
}
