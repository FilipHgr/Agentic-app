/** České texty menu (#67). */

import type { MenuTexts } from './menuTextsTypes';

export default {
  categories: {
    all: { title: 'Vše' },
    addingSubtracting: { title: 'Sčítání a odčítání' },
    drawing: { title: 'Kreslení' },
  },
  profiles: {
    nicknameTitle: 'Přezdívka',
    colorTitle: 'Barva',
    deleteQuestion: 'Smazat profil?',
    deleteConfirm: 'Smazat',
    deleteCancel: 'Zpět',
  },
  rudyLines: {
    greeting: 'Ahoj, já jsem Rudy! Vyber si hru.',
  },
} satisfies MenuTexts;
