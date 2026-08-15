export const TEXT_CASING = Object.freeze({
  UPPERCASE: 'uppercase',
  SENTENCE: 'sentence',
  LOWERCASE: 'lowercase',
  CAPITALIZE_WORDS: 'capitalize-words',
  TOGGLE: 'toggle',
});

const isLetter = (character) => /\p{L}/u.test(character);

const toSentenceCase = (text) => {
  let startsSentence = true;

  return Array.from(text.toLocaleLowerCase()).map((character) => {
    if (isLetter(character)) {
      if (startsSentence) {
        startsSentence = false;
        return character.toLocaleUpperCase();
      }
      return character;
    }

    if (character === '.' || character === '!' || character === '?' || character === '\n') {
      startsSentence = true;
    }
    return character;
  }).join('');
};

const capitalizeEachWord = (text) => text
  .toLocaleLowerCase()
  .replace(/\p{L}[\p{L}\p{M}\p{N}'’]*/gu, (word) => {
    const [firstCharacter, ...remainingCharacters] = Array.from(word);
    return firstCharacter.toLocaleUpperCase() + remainingCharacters.join('');
  });

const toggleCase = (text) => Array.from(text).map((character) => {
  const uppercase = character.toLocaleUpperCase();
  const lowercase = character.toLocaleLowerCase();

  if (character === uppercase && character !== lowercase) return lowercase;
  if (character === lowercase && character !== uppercase) return uppercase;
  return character;
}).join('');

export const applyTextCasing = (text, casing) => {
  const value = String(text ?? '');

  switch (casing) {
    case TEXT_CASING.UPPERCASE:
      return value.toLocaleUpperCase();
    case TEXT_CASING.SENTENCE:
      return toSentenceCase(value);
    case TEXT_CASING.LOWERCASE:
      return value.toLocaleLowerCase();
    case TEXT_CASING.CAPITALIZE_WORDS:
      return capitalizeEachWord(value);
    case TEXT_CASING.TOGGLE:
      return toggleCase(value);
    default:
      return value;
  }
};
