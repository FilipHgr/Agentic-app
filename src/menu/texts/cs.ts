/** České texty menu (#67). */

import type { MenuTexts } from './menuTextsTypes';

export default {
  categories: {
    all: { title: 'Vše' },
    addingSubtracting: { title: 'Sčítání a odčítání' },
  },
  profiles: {
    nicknameTitle: 'Přezdívka',
    colorTitle: 'Barva',
    deleteQuestion: 'Smazat profil?',
    deleteConfirm: 'Smazat',
    deleteCancel: 'Zpět',
  },
} satisfies MenuTexts;
