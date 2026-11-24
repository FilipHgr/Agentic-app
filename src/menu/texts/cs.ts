/** České texty menu (#67). */

import type { MenuTexts } from './menuTextsTypes';

export default {
  categories: {
    all: { title: 'Vše' },
    math: { title: 'Matematika' },
    create: { title: 'Tvoření' },
  },
  profiles: {
    nicknameTitle: 'Přezdívka',
    colorTitle: 'Barva',
    deleteQuestion: 'Smazat profil?',
    deleteConfirm: 'Smazat',
    deleteCancel: 'Zpět',
  },
  overview: {
    title: 'Přehled',
    back: 'Zpět',
    weekTab: '7 dní',
    mistakesTab: 'Chyby',
    weekTitle: 'Vyřešené příklady za 7 dní',
    legendNotFirstTry: 'Po chybě nebo s nápovědou',
    legendAfterMistake: 'Po chybě',
    legendFirstTry: 'Napoprvé',
    totalSolved: 'Za týden vyřešeno',
    totalFirstTry: 'Z toho napoprvé',
    empty: 'Zatím žádné příklady',
    dayNames: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
    mistakesTitle: 'Kde se dítě plete (7 dní)',
    firstTryHeading: 'Vyřešeno napoprvé',
    addition: 'Sčítání',
    subtraction: 'Odčítání',
    frequentHeading: 'Nejčastější chyby',
    frequentItem: '{problem} ({count}×)',
    noFrequent: 'Bez častých chyb',
    hintsUsed: 'Nápověda za týden',
  },
} satisfies MenuTexts;
