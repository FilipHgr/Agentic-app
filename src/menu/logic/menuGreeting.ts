/**
 * Kdy Rudy v menu pozdraví (#170 AC4), bez Phaseru. Pozdrav je při prvním
 * ukázání menu po načtení stránky (po výběru profilu, pokud se ukazuje)
 * a po návratu ze hry jen tehdy, když od posledního pozdravu na téže
 * stránce uběhlo aspoň 10 minut. Další ukázání menu (po změně profilu)
 * ani změna jazyka nepozdraví. Paměť je jen pro toto načtení stránky,
 * nic se neukládá. Čas (ms) dává volající.
 *
 * Zopakování nahlas (#173): když první pozdrav proběhl bez hlasu, protože
 * zvuk ještě nebyl odemčený (Safari ho pustí až po dotyku), Rudy pozdrav
 * jednou zopakuje s hlasem:
 * - po prvním ťuknutí v menu mimo dlaždici hry; ťuknutí se přitom provede
 *   normálně (vybere kategorii, otevře nabídku…),
 * - nebo po zavření tichého okna, když do něj dítě ťuklo (ťuknutí odemklo
 *   zvuk); další ťuknutí do menu už nic neopakuje.
 * Když byl zvuk odemčený a jen se nestáhla nahrávka, nezopakuje se.
 * Ťuknutí na dlaždici hru spustí a pozdrav se už neopakuje. Nahrávka se
 * začne stahovat hned po odemčení zvuku. Když se okno neukáže do
 * `MENU_GREETING_REPLAY_WAIT_MS` od ťuknutí (nebo od zavření tichého
 * okna), zopakování se vynechá. Dokud menu zakrývá panel (nabídka jazyků,
 * seznam kategorií, výběr profilu), pozdrav se neukáže.
 */

/** Po návratu ze hry pozdraví Rudy znovu až po takové době od posledního pozdravu. */
export const MENU_GREETING_PAUSE_MS = 10 * 60 * 1000;

/** Nejdéle tak dlouho po ťuknutí se čeká na okno zopakovaného pozdravu, než se vynechá. */
export const MENU_GREETING_REPLAY_WAIT_MS = 1500;

/**
 * Proč se menu ukázalo: `shown` menu je vidět (start stránky, zavření
 * výběru profilu), `returnedFromGame` návrat ze hry domečkem.
 */
export type MenuShownReason = 'shown' | 'returnedFromGame';

/** Kam dítě ťuklo: na dlaždici hry, do okna s pozdravem, nebo jinam v menu. */
export type MenuTapTarget = 'game' | 'greetingWindow' | 'other';

/** Jak okno s pozdravem proběhlo: s hlasem a jestli byl zvuk odemčený. */
export interface MenuGreetingOpened {
  readonly withVoice: boolean;
  readonly audioUnlocked: boolean;
}

/** Stav stránky v jednom snímku. */
export interface MenuGreetingFrame {
  readonly audioUnlocked: boolean;
  /** Menu zakrývá panel nebo výběr profilu (pozdrav se teď neukáže). */
  readonly covered: boolean;
}

/**
 * Co udělat se zopakováním v tomto snímku: nic, čekat, ukázat pozdrav
 * (okno smí čekat na stažení nejvýš `waitMs`), nebo ho vynechat.
 */
export type MenuGreetingReplayStep =
  | { readonly kind: 'none' }
  | { readonly kind: 'wait' }
  | { readonly kind: 'show'; readonly waitMs: number }
  | { readonly kind: 'giveUp' };

export interface MenuGreeting {
  /** Menu se ukázalo; vrátí, jestli má Rudy pozdravit. */
  menuShown(reason: MenuShownReason, now: number): boolean;
  /** Okno s pozdravem se opravdu ukázalo v čase `now`. */
  greeted(now: number, opened: MenuGreetingOpened): void;
  /** Okno s pozdravem se zavřelo v čase `now`. */
  greetingClosed(now: number): void;
  /** Dítě ťuklo; ťuknutí se provede normálně, jen může spustit zopakování. */
  tapped(target: MenuTapTarget, now: number): void;
  /** Má se teď začít stahovat nahrávka pozdravu? `true` jen jednou. */
  shouldPrepareVoice(audioUnlocked: boolean): boolean;
  /** Co se zopakovaným pozdravem teď; volá se každý snímek. */
  replayStep(now: number, frame: MenuGreetingFrame): MenuGreetingReplayStep;
}

export function createMenuGreeting(): MenuGreeting {
  let firstShowDone = false;
  let lastGreetingAt: number | null = null;
  /** První pozdrav stránky ještě neproběhl (čeká na okno). */
  let awaitingFirstGreeting = false;
  /** První pozdrav byl tichý kvůli zamčenému zvuku; zopakování ještě nezačalo. */
  let replayOffered = false;
  /** Tiché okno je otevřené a dítě do něj ťuklo: zopakuje se po zavření. */
  let greetingWindowOpen = false;
  let tappedInWindow = false;
  /** Od kdy zopakování čeká na okno; `null` bez čekajícího zopakování. */
  let replayStartedAt: number | null = null;
  let voicePrepared = false;

  function pauseIsOver(now: number): boolean {
    if (lastGreetingAt === null) {
      return true;
    }
    const elapsed = now - lastGreetingAt;
    return Number.isFinite(elapsed) && elapsed >= MENU_GREETING_PAUSE_MS;
  }

  /** Zopakování už nepřijde (spustila se hra nebo přišel jiný pozdrav). */
  function dropReplay(): void {
    awaitingFirstGreeting = false;
    replayOffered = false;
    tappedInWindow = false;
    replayStartedAt = null;
  }

  function startReplay(now: number): void {
    replayOffered = false;
    tappedInWindow = false;
    replayStartedAt = now;
  }

  return {
    menuShown(reason: MenuShownReason, now: number): boolean {
      if (reason === 'returnedFromGame') {
        dropReplay();
        return pauseIsOver(now);
      }
      if (firstShowDone) {
        return false;
      }
      firstShowDone = true;
      awaitingFirstGreeting = true;
      return true;
    },

    greeted(now: number, opened: MenuGreetingOpened): void {
      lastGreetingAt = now;
      greetingWindowOpen = true;
      const wasFirst = awaitingFirstGreeting;
      dropReplay();
      replayOffered = wasFirst && !opened.withVoice && !opened.audioUnlocked;
    },

    greetingClosed(now: number): void {
      greetingWindowOpen = false;
      if (replayOffered && tappedInWindow) {
        startReplay(now);
      }
    },

    tapped(target: MenuTapTarget, now: number): void {
      if (target === 'game') {
        dropReplay();
        return;
      }
      if (!replayOffered) {
        return;
      }
      if (target === 'greetingWindow') {
        tappedInWindow = greetingWindowOpen;
        return;
      }
      if (!greetingWindowOpen) {
        startReplay(now);
      }
    },

    shouldPrepareVoice(audioUnlocked: boolean): boolean {
      const replayAhead = replayOffered || replayStartedAt !== null;
      if (!audioUnlocked || voicePrepared || !replayAhead) {
        return false;
      }
      voicePrepared = true;
      return true;
    },

    replayStep(now: number, frame: MenuGreetingFrame): MenuGreetingReplayStep {
      if (replayStartedAt === null) {
        return { kind: 'none' };
      }
      const waited = now - replayStartedAt;
      const waitMs = MENU_GREETING_REPLAY_WAIT_MS - waited;
      if (!Number.isFinite(waitMs) || waitMs <= 0) {
        replayStartedAt = null;
        return { kind: 'giveUp' };
      }
      if (!frame.audioUnlocked || frame.covered) {
        return { kind: 'wait' };
      }
      replayStartedAt = null;
      return { kind: 'show', waitMs };
    },
  };
}
