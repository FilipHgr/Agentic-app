/** České texty hry Porovnávání (#178, #179, #181, #182). */

import type { CompareTexts } from './compareTexts';

export default {
  title: 'Porovnávání',
  rowLabels: {
    maxNumber: 'Do kolika',
    show: 'Ukázat',
    question: 'Otázka',
  },
  rudyLines: {
    greeting: 'Ahoj, já jsem Rudy! Kde je víc?',
    greetingAgain: 'Zase já, Rudy! Jdeme porovnávat!',
    celebration: 'Hurá! Máš deset hvězdiček!',
    celebrationMore: 'Výborně! Vždycky poznáš, kde je víc!',
  },
  guideLines: {
    questionMore: 'Kde je víc?',
    questionLess: 'Kde je míň?',
  },
} satisfies CompareTexts;
