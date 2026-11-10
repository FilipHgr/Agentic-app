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
} satisfies CountingTexts;
