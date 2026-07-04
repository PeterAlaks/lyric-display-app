// Project: LyricDisplay App
// File: src/constants/scripture.js
// Canonical Bible book metadata and the free/public-domain translations
// served by the bible-api.com public API.

export const SCRIPTURE_API_BASE_URL = 'https://bible-api.com';

export const DEFAULT_SCRIPTURE_TRANSLATION = 'kjv';

// Public domain / freely licensed translations available on bible-api.com.
export const SCRIPTURE_TRANSLATIONS = [
  { id: 'kjv', abbreviation: 'KJV', name: 'King James Version', language: 'English' },
  { id: 'web', abbreviation: 'WEB', name: 'World English Bible', language: 'English' },
  { id: 'webbe', abbreviation: 'WEBBE', name: 'World English Bible (British)', language: 'English' },
  { id: 'asv', abbreviation: 'ASV', name: 'American Standard Version (1901)', language: 'English' },
  { id: 'bbe', abbreviation: 'BBE', name: 'Bible in Basic English', language: 'English' },
  { id: 'darby', abbreviation: 'DARBY', name: 'Darby Bible', language: 'English' },
  { id: 'dra', abbreviation: 'DRA', name: 'Douay-Rheims (1899)', language: 'English' },
  { id: 'ylt', abbreviation: 'YLT', name: "Young's Literal Translation", language: 'English' },
  { id: 'oeb-us', abbreviation: 'OEB', name: 'Open English Bible (US)', language: 'English' },
  { id: 'clementine', abbreviation: 'VULG', name: 'Clementine Latin Vulgate', language: 'Latin' },
  { id: 'almeida', abbreviation: 'ALMEIDA', name: 'João Ferreira de Almeida', language: 'Portuguese' },
  { id: 'rccv', abbreviation: 'RCCV', name: 'Romanian Corrected Cornilescu', language: 'Romanian' },
];

export const getScriptureTranslation = (id) =>
  SCRIPTURE_TRANSLATIONS.find((translation) => translation.id === id) || null;

// The 66 books of the Protestant canon with chapter counts and common
// abbreviations that are not already a prefix of the book name.
export const BIBLE_BOOKS = [
  { name: 'Genesis', chapters: 50, aliases: [] },
  { name: 'Exodus', chapters: 40, aliases: [] },
  { name: 'Leviticus', chapters: 27, aliases: [] },
  { name: 'Numbers', chapters: 36, aliases: [] },
  { name: 'Deuteronomy', chapters: 34, aliases: ['dt'] },
  { name: 'Joshua', chapters: 24, aliases: [] },
  { name: 'Judges', chapters: 21, aliases: ['jdg'] },
  { name: 'Ruth', chapters: 4, aliases: [] },
  { name: '1 Samuel', chapters: 31, aliases: [] },
  { name: '2 Samuel', chapters: 24, aliases: [] },
  { name: '1 Kings', chapters: 22, aliases: [] },
  { name: '2 Kings', chapters: 25, aliases: [] },
  { name: '1 Chronicles', chapters: 29, aliases: [] },
  { name: '2 Chronicles', chapters: 36, aliases: [] },
  { name: 'Ezra', chapters: 10, aliases: [] },
  { name: 'Nehemiah', chapters: 13, aliases: [] },
  { name: 'Esther', chapters: 10, aliases: [] },
  { name: 'Job', chapters: 42, aliases: [] },
  { name: 'Psalms', chapters: 150, aliases: ['psalm'] },
  { name: 'Proverbs', chapters: 31, aliases: ['prv'] },
  { name: 'Ecclesiastes', chapters: 12, aliases: ['qoheleth'] },
  { name: 'Song of Solomon', chapters: 8, aliases: ['song of songs', 'songs', 'sos', 'canticles'] },
  { name: 'Isaiah', chapters: 66, aliases: [] },
  { name: 'Jeremiah', chapters: 52, aliases: [] },
  { name: 'Lamentations', chapters: 5, aliases: [] },
  { name: 'Ezekiel', chapters: 48, aliases: ['ezk'] },
  { name: 'Daniel', chapters: 12, aliases: [] },
  { name: 'Hosea', chapters: 14, aliases: [] },
  { name: 'Joel', chapters: 3, aliases: [] },
  { name: 'Amos', chapters: 9, aliases: [] },
  { name: 'Obadiah', chapters: 1, aliases: [] },
  { name: 'Jonah', chapters: 4, aliases: [] },
  { name: 'Micah', chapters: 7, aliases: [] },
  { name: 'Nahum', chapters: 3, aliases: [] },
  { name: 'Habakkuk', chapters: 3, aliases: [] },
  { name: 'Zephaniah', chapters: 3, aliases: [] },
  { name: 'Haggai', chapters: 2, aliases: [] },
  { name: 'Zechariah', chapters: 14, aliases: [] },
  { name: 'Malachi', chapters: 4, aliases: [] },
  { name: 'Matthew', chapters: 28, aliases: ['mt'] },
  { name: 'Mark', chapters: 16, aliases: ['mk'] },
  { name: 'Luke', chapters: 24, aliases: ['lk'] },
  { name: 'John', chapters: 21, aliases: ['jn'] },
  { name: 'Acts', chapters: 28, aliases: [] },
  { name: 'Romans', chapters: 16, aliases: [] },
  { name: '1 Corinthians', chapters: 16, aliases: [] },
  { name: '2 Corinthians', chapters: 13, aliases: [] },
  { name: 'Galatians', chapters: 6, aliases: [] },
  { name: 'Ephesians', chapters: 6, aliases: [] },
  { name: 'Philippians', chapters: 4, aliases: ['php'] },
  { name: 'Colossians', chapters: 4, aliases: [] },
  { name: '1 Thessalonians', chapters: 5, aliases: [] },
  { name: '2 Thessalonians', chapters: 3, aliases: [] },
  { name: '1 Timothy', chapters: 6, aliases: [] },
  { name: '2 Timothy', chapters: 4, aliases: [] },
  { name: 'Titus', chapters: 3, aliases: [] },
  { name: 'Philemon', chapters: 1, aliases: ['phlm', 'phm'] },
  { name: 'Hebrews', chapters: 13, aliases: [] },
  { name: 'James', chapters: 5, aliases: ['jas'] },
  { name: '1 Peter', chapters: 5, aliases: [] },
  { name: '2 Peter', chapters: 3, aliases: [] },
  { name: '1 John', chapters: 5, aliases: ['1jn'] },
  { name: '2 John', chapters: 1, aliases: ['2jn'] },
  { name: '3 John', chapters: 1, aliases: ['3jn'] },
  { name: 'Jude', chapters: 1, aliases: [] },
  { name: 'Revelation', chapters: 22, aliases: ['apocalypse'] },
];
