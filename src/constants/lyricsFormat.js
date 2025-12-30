export const RELIGIOUS_WORDS = ['jesus', 'jehovah', 'god', 'yahweh', 'lord', 'christ', 'holy ghost',
  'holy spirit', 'bible', 'amen', 'hallelujah', 'hosanna', 'savior', 'saviour', 'redeemer', 'messiah'];

export const LATIN_LETTER_REGEX = /[A-Za-z]/;

export const ENGLISH_HINT_WORDS = [...RELIGIOUS_WORDS, 'the', 'and', 'for', 'with', 'praise', 'glory', 'grace', 'mercy', 'love', 'king', 'queen', 'strength', 'light', 'power', 'redeemer', 'savior', 'saviour', 'spirit', 'amen', 'hallelujah', 'we', 'you', 'your', 'our', 'their', 'his', 'her', 'who', 'what', 'where', 'when', 'why', 'how', 'this', 'that', 'these', 'those', 'shall', 'will', 'hope', 'faith', 'joy', 'peace', 'deliver', 'deliverer', 'rescue', 'comfort', 'comforter', 'guide', 'helper'];

export const ENGLISH_HINT_REGEXES = ENGLISH_HINT_WORDS.map((word) => new RegExp(`\\b${word}\\b`, 'i'));