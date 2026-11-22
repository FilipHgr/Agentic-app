/**
 * Otázka Porovnávání (#182): „kde je víc?“, nebo „kde je míň?“. Rodič
 * v nastavení volí víc, míň, nebo střídat; při střídání se otázka losuje
 * pro každý příklad zvlášť (asi v polovině „míň“) a v příkladu se už
 * nemění. Otázku dítě pozná bez čtení podle symbolu nad kartami (velká
 * hromádka = víc, malá = míň) a dospělý hlas průvodce ji řekne, když se
 * změní. Čistý TypeScript bez Phaseru i bez prohlížeče: scéna symbol jen
 * nakreslí a hlasu dá přehrávač.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import type { Dot, Rect } from './compareLayout';
import type { CompareQuestion } from './compareProblems';
import type { QuestionSetting } from './compareSettings';

export type { CompareQuestion } from './compareProblems';

/** Jak velká část příkladů je při střídání „kde je míň“. */
export const LESS_SHARE_WHEN_ALTERNATING = 0.5;

/** Otázka dalšího příkladu podle nastavení; při střídání podle náhody [0, 1). */
export function nextQuestion(setting: QuestionSetting, random: () => number): CompareQuestion {
  if (setting === 'alternate') {
    return random() < LESS_SHARE_WHEN_ALTERNATING ? 'less' : 'more';
  }
  return setting;
}

// ---------------------------------------------------------------------------
// Symbol: hromádka teček na podložce
// ---------------------------------------------------------------------------

/** Tečky v řadách hromádky odspodu: velká hromádka (víc) a malá (míň). */
const PILE_ROWS: Readonly<Record<CompareQuestion, readonly number[]>> = {
  more: [4, 3, 2, 1],
  less: [2, 1],
};
/** Řady velké hromádky: podle ní se počítá velikost teček obou hromádek. */
const BIGGEST_PILE = PILE_ROWS.more;

/** Rozestup teček v řadě jako násobek poloměru (tečky se nedotýkají). */
const DOT_STEP_RADII = 2.3;
/** Řada nad řadou: jako koule v hromádce, posunutá o půl tečky. */
const ROW_RISE_RADII = DOT_STEP_RADII * 0.87;
/** Podložka pod hromádkou: mezera nad ní, tloušťka a přesah do stran (násobky poloměru). */
const GROUND_GAP_RADII = 0.5;
const GROUND_HEIGHT_RADII = 0.8;
const GROUND_OVERHANG_RADII = 0.6;
/**
 * Okraj uvnitř místa symbolu jako díl jeho šířky a výšky. Žádný: velká
 * hromádka s podložkou vyplní celou vyhrazenou výšku (#182).
 */
const PICTURE_PADDING_SHARE = 0;

/** Obrázek symbolu: tečky hromádky a podložky, na kterých hromádky stojí. */
export interface QuestionPicture {
  readonly dots: readonly Dot[];
  readonly grounds: readonly Rect[];
}

function pileWidthRadii(rows: readonly number[]): number {
  const widest = Math.max(...rows);
  return (widest - 1) * DOT_STEP_RADII + 2;
}

function pileHeightRadii(rows: readonly number[]): number {
  return (rows.length - 1) * ROW_RISE_RADII + 2;
}

/** Šířka a výška celého obrázku (velká hromádka s podložkou) v poloměrech teček. */
const PICTURE_WIDTH_RADII = pileWidthRadii(BIGGEST_PILE) + 2 * GROUND_OVERHANG_RADII;
const PICTURE_HEIGHT_RADII = pileHeightRadii(BIGGEST_PILE) + GROUND_GAP_RADII + GROUND_HEIGHT_RADII;

/**
 * Symbol otázky v obdélníku `box`: hromádka teček ve tvaru kopečku na
 * podložce. Velká i malá hromádka mají stejně velké tečky a stojí na
 * stejné podložce, takže se liší jen velikostí hromádky.
 */
export function questionPicture(question: CompareQuestion, box: Rect): QuestionPicture {
  const innerWidth = box.width * (1 - 2 * PICTURE_PADDING_SHARE);
  const innerHeight = box.height * (1 - 2 * PICTURE_PADDING_SHARE);
  const radius = Math.min(innerWidth / PICTURE_WIDTH_RADII, innerHeight / PICTURE_HEIGHT_RADII);
  const centerX = box.left + box.width / 2;
  const pictureTop = box.top + (box.height - PICTURE_HEIGHT_RADII * radius) / 2;
  const groundTop = pictureTop + (PICTURE_HEIGHT_RADII - GROUND_HEIGHT_RADII) * radius;
  const ground: Rect = {
    left: centerX - (PICTURE_WIDTH_RADII * radius) / 2,
    top: groundTop,
    width: PICTURE_WIDTH_RADII * radius,
    height: GROUND_HEIGHT_RADII * radius,
  };
  const bottomRowY = groundTop - GROUND_GAP_RADII * radius - radius;
  const dots: Dot[] = [];
  PILE_ROWS[question].forEach((count, row) => {
    const firstX = centerX - ((count - 1) * DOT_STEP_RADII * radius) / 2;
    for (let index = 0; index < count; index += 1) {
      dots.push({
        x: firstX + index * DOT_STEP_RADII * radius,
        y: bottomRowY - row * ROW_RISE_RADII * radius,
        radius,
      });
    }
  });
  return { dots, grounds: [ground] };
}

// ---------------------------------------------------------------------------
// Hlas průvodce
// ---------------------------------------------------------------------------

/** Věty průvodce v textech hry (`guideLines`) a názvy nahrávek. */
export const COMPARE_GUIDE_LINES = ['questionMore', 'questionLess'] as const;

export type CompareGuideLine = (typeof COMPARE_GUIDE_LINES)[number];

/** Věta průvodce, která otázku řekne. */
export function questionVoiceLine(question: CompareQuestion): CompareGuideLine {
  return question === 'more' ? 'questionMore' : 'questionLess';
}

/** Nahrávka otázky jako soubor hry (`public/voice/<jazyk>/compare/guide/<věta>.mp3`). */
export function compareQuestionVoiceUrl(
  question: CompareQuestion,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/compare/guide/${questionVoiceLine(question)}.mp3`;
}

/** Hlas, který otázku řekne; sezení hry ho volá, když se otázka změní. */
export interface CompareQuestionVoice {
  /**
   * Řekne otázku. Splní se `true`, když nahrávka opravdu začala hrát;
   * `false` při zamčeném zvuku, chybějící nahrávce nebo když ji mezitím
   * nahradila jiná otázka či zastavení. Nikdy se nezamítne.
   */
  say(question: CompareQuestion): Promise<boolean>;
  /** Zastaví rozehranou otázku (nastavení, odchod). */
  stop(): void;
}

/** Přehrávač nahrávek: stáhne a připraví, pustí a zastaví. Nesmí vyhodit výjimku. */
export interface QuestionVoicePlayer {
  /** Stáhne a dekóduje nahrávku; splní se délkou v ms, při chybě se zamítne. */
  load(url: string): Promise<number>;
  play(url: string): void;
  stop(): void;
}

export interface QuestionVoiceOptions {
  readonly player: QuestionVoicePlayer;
  /** Je zvuk prohlížeče odemčený? Bez něj hlas mlčí a otázku ukáže jen symbol (AC5). */
  readonly isUnlocked: () => boolean;
}

/**
 * Hlas otázky: nahrávku v jazyce zvoleném v menu stáhne až při prvním
 * vyslovení a pak ji pustí. Když se otázka mezitím změní nebo hlas
 * zastaví, stažená nahrávka už nezazní. Chybějící nahrávka je ticho.
 */
export function createQuestionVoice(options: QuestionVoiceOptions): CompareQuestionVoice {
  const loaded = new Set<string>();
  let wanted: string | null = null;

  /** Pustí nahrávku, jen když je pořád chtěná; vrátí, jestli hraje. */
  const playIfWanted = (url: string): boolean => {
    if (wanted !== url) {
      return false;
    }
    options.player.play(url);
    return true;
  };

  return {
    say: async (question) => {
      if (!options.isUnlocked()) {
        return false;
      }
      const url = compareQuestionVoiceUrl(question);
      wanted = url;
      if (!loaded.has(url)) {
        try {
          await options.player.load(url);
        } catch {
          // Nahrávka chybí nebo nejde přehrát: otázku dítě pozná podle symbolu
          // a hra to zkusí znovu příště.
          if (wanted === url) {
            wanted = null;
          }
          return false;
        }
        loaded.add(url);
      }
      return playIfWanted(url);
    },
    stop: () => {
      wanted = null;
      options.player.stop();
    },
  };
}
