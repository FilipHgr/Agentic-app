/**
 * Změřené barvy obrázků map postupu (#134, kontrast z kontroly #133).
 *
 * Node ve Vitestu WebP nepřečte (projekt nemá dekodér, `sharp` je jen
 * nepřímá závislost `wrangler`), proto jsou barvy obrázků změřené předem:
 * každý obrázek je rozdělený na mřížku 4 × 4 stejných dílů a `tones` je
 * průměrná barva dílu po řádcích shora (v řádku zleva). `sha256` váže
 * měření na soubor: když se obrázek vymění, test otisku selže a barvy se
 * musí změřit znovu, například
 *
 *   convert <soubor> -filter Box -resize 4x4! txt:- | grep -o '#[0-9A-F]\{6\}'
 *   sha256sum <soubor>
 *
 * (ImageMagick u vývojáře, ne v testech ani ve hře).
 */

/** Strana mřížky, ve které jsou barvy změřené. */
export const TONE_GRID = 4;

export interface PictureTones {
  readonly sha256: string;
  /** `TONE_GRID × TONE_GRID` barev `#RRGGBB` po řádcích shora, v řádku zleva. */
  readonly tones: readonly string[];
}

export const PICTURE_TONES: Readonly<Record<string, PictureTones>> = {
  'castle-landscape.webp': {
    sha256: 'bf15f60f07250f62a58015249fa3acd48e6e56e7db990b848780471ddb079b33',
    tones: [
      '#8BA36C',
      '#8FBE88',
      '#78B9B2',
      '#90A396',
      '#8FAA4C',
      '#B9D13F',
      '#A7C650',
      '#87AB7F',
      '#66A78B',
      '#B0CB3F',
      '#B5CE41',
      '#8CB057',
      '#638C49',
      '#87AE3B',
      '#8AA944',
      '#98AE54',
    ],
  },
  'castle-portrait.webp': {
    sha256: '2cc9f1961a08f34562f177a2fca5a898cc2fd7e1584dbc06f396d952d492629d',
    tones: [
      '#83B69B',
      '#8ACAAE',
      '#99B394',
      '#81BA97',
      '#98B445',
      '#B5D53F',
      '#B5D540',
      '#7AAA6B',
      '#97C03F',
      '#B3D33C',
      '#B4D33D',
      '#8CB539',
      '#6BB087',
      '#9FC345',
      '#9AC23A',
      '#89A84D',
    ],
  },
  'forest-landscape.webp': {
    sha256: '97056d9d006fa68e022e361aef78ff1fea65b64f11239b7dfedec622d3cd823f',
    tones: [
      '#649C81',
      '#87B968',
      '#82BD8F',
      '#789C41',
      '#71A760',
      '#BAD43D',
      '#B6D23B',
      '#95B43D',
      '#83A357',
      '#9BBE49',
      '#B0CF3E',
      '#88AE44',
      '#61973E',
      '#6AA580',
      '#629B3C',
      '#588C3F',
    ],
  },
  'forest-portrait.webp': {
    sha256: '9090d6dcc0718253fd1c69bc5e275650be5e26b4aa08d100fd11b50b83636365',
    tones: [
      '#64986D',
      '#87B670',
      '#9ACB9A',
      '#6AA57B',
      '#74A85A',
      '#BDD240',
      '#BED441',
      '#7AA946',
      '#7CA231',
      '#B6CF3E',
      '#B6CF3E',
      '#77A448',
      '#5F9748',
      '#A2C13F',
      '#95B843',
      '#4B894F',
    ],
  },
  'island-landscape.webp': {
    sha256: 'ac46cbbaf6e8b30ab49fa020af39eb9730129444e8d2f1f5efa9cde866160c3f',
    tones: [
      '#72CDD6',
      '#9FD296',
      '#81B69A',
      '#73CBDB',
      '#8BBA8A',
      '#E3E272',
      '#ECE483',
      '#A6D38D',
      '#A0DDC9',
      '#EBE27E',
      '#D0D469',
      '#A1CFA7',
      '#48D1DF',
      '#98E2D2',
      '#98D9C4',
      '#58CAD4',
    ],
  },
  'island-portrait.webp': {
    sha256: '9332f84a16f08626d96c327b689e185798c4371d7837c2f8dcaf5936d24f6ee4',
    tones: [
      '#69CBC7',
      '#7DCAAD',
      '#8EB596',
      '#79C0A7',
      '#A1B77D',
      '#D5D670',
      '#E7DE7A',
      '#B1CA6D',
      '#B2C468',
      '#E5DD76',
      '#E5DB79',
      '#B1C586',
      '#64BDC1',
      '#8AD8CA',
      '#70C7BB',
      '#5AC8C9',
    ],
  },
  'space-landscape.webp': {
    sha256: '645c6835fd4179e375e3216f54014b44945526324be8c7977a221954a54eb9e1',
    tones: [
      '#7D7C98',
      '#1B3187',
      '#1D2970',
      '#533A88',
      '#3C3D83',
      '#15297C',
      '#142B7D',
      '#1E3084',
      '#3B5F9C',
      '#17267A',
      '#142879',
      '#443F6D',
      '#3F7E9C',
      '#332A78',
      '#272B82',
      '#A1645D',
    ],
  },
  'space-portrait.webp': {
    sha256: 'b823770de45ec5bb7f93939d5a14c109fc3a854d8dfb9e4daa662e37b5d3d300',
    tones: [
      '#7C5E82',
      '#1C2B69',
      '#3A4573',
      '#5D5C7D',
      '#3F3F8E',
      '#152D79',
      '#152D79',
      '#2A4D83',
      '#293584',
      '#182F7D',
      '#192F7C',
      '#285393',
      '#4F99B3',
      '#314888',
      '#182D76',
      '#3D4598',
    ],
  },
  'underwater-landscape.webp': {
    sha256: 'aacf8e7056cce2898415a502bac7b4a87c0456991a2c672c755781b119f30b4f',
    tones: [
      '#5A8677',
      '#5DA991',
      '#4EC4BE',
      '#53988B',
      '#AFB89C',
      '#E0E5B5',
      '#D8E5B7',
      '#AEB795',
      '#A0B78B',
      '#E9E4AF',
      '#EBE5B1',
      '#ADB58D',
      '#768B77',
      '#A7BC8E',
      '#C5C899',
      '#908D7A',
    ],
  },
  'underwater-portrait.webp': {
    sha256: '171c7c0397d1571fbf18fcc309493c81e67df931489862b7f43d9d4d3ebc3dd8',
    tones: [
      '#5097A7',
      '#63CED3',
      '#55B9C3',
      '#469EA8',
      '#789292',
      '#E2E1B5',
      '#ECE9BB',
      '#AEB49B',
      '#C5C299',
      '#FAEAB2',
      '#F4E5AE',
      '#B6AB75',
      '#798184',
      '#E2D4A1',
      '#F9E7AB',
      '#A2AA87',
    ],
  },
};
