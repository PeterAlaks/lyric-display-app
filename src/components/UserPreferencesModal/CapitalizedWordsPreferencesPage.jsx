import {
  MAX_CAPITALIZED_WORD_LENGTH,
  normalizeCapitalizedWord,
  normalizeCapitalizedWords,
} from '../../../shared/capitalizedWords.js';
import EditablePhraseListPreferencesPage from './EditablePhraseListPreferencesPage';

const CapitalizedWordsPreferencesPage = (props) => (
  <EditablePhraseListPreferencesPage
    {...props}
    addButtonLabel="Add new word"
    deleteDescription="This word will no longer be automatically capitalized during lyric cleanup."
    description="These words and phrases are title-cased when Capitalize Religious Terms is enabled."
    emptyDescription="Add a word or phrase to use it during lyric cleanup."
    emptyTitle="No capitalized words"
    inputAriaNoun="word or phrase"
    inputPlaceholder="Enter a word or phrase"
    invalidValueMessage={`Use up to ${MAX_CAPITALIZED_WORD_LENGTH} letters, numbers, spaces, apostrophes, or hyphens.`}
    maxLength={MAX_CAPITALIZED_WORD_LENGTH}
    normalizeValue={normalizeCapitalizedWord}
    normalizeValues={normalizeCapitalizedWords}
    onValuesChange={props.onWordsChange}
    title="Capitalized Words"
    values={props.words}
  />
);

export default CapitalizedWordsPreferencesPage;
