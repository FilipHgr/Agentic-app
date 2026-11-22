/** České texty hry Počítání (#65). Věty průvodce podle scénáře v #50. */

import type { CountingTexts } from './countingTexts';

export default {
  title: 'Počítání',
  rowLabels: {
    maxNumber: 'Do kolika',
    operations: 'Příklady',
    answerInput: 'Odpověď',
  },
  guideButtons: {
    back: 'Zpět',
    next: 'Další',
    startPlaying: 'Začít hrát',
  },
  guideLines: {
    maxNumber: [
      'Největší číslo, které se v příkladech objeví.',
      'Začněte menším číslem a přidávejte, až to dítě zvládá.',
    ],
    operations: [
      'Sčítání, odčítání, nebo obojí zamíchané.',
      'Začněte sčítáním. Obojí, až dítě zvládne odčítat.',
    ],
    answerInput: [
      'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.',
      'Tužku zvolte, až dítě umí psát všechny číslice.',
    ],
    summary: [
      'Hotovo. Volby můžete ještě změnit ťuknutím.',
      'Později je změníte podržením kolečka vpravo nahoře.',
    ],
  },
  rudyLines: {
    greeting: 'Ahoj, já jsem Rudy! Pojďme spolu počítat.',
    greetingAgain: 'Zase já, Rudy! Jdeme počítat!',
    celebration: 'Hurá! Deset hvězdiček, jsi šikula!',
    celebrationStars: 'Paráda! Máš všech deset hvězdiček!',
    celebrationStar: 'Jupí! Jsi počítací hvězda!',
  },
  overview: {
    button: 'Přehled',
    title: 'Vyřešené příklady za 7 dní',
    legendNotFirstTry: 'Po chybě nebo s nápovědou',
    legendFirstTry: 'Napoprvé',
    totalSolved: 'Za týden vyřešeno',
    totalFirstTry: 'Z toho napoprvé',
    empty: 'Zatím žádné příklady',
    back: 'Zpět',
    dayNames: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
  },
  mistakes: {
    button: 'Chyby',
    title: 'Kde se dítě plete (7 dní)',
    firstTryHeading: 'Vyřešeno napoprvé',
    addition: 'Sčítání',
    subtraction: 'Odčítání',
    frequentHeading: 'Nejčastější chyby',
    frequentItem: '{problem} ({count}×)',
    noFrequent: 'Bez častých chyb',
    hintsUsed: 'Nápověda za týden',
  },
} satisfies CountingTexts;
