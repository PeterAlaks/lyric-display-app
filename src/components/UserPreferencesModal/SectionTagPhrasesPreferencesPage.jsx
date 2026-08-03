import {
  MAX_SECTION_TAG_PHRASE_LENGTH,
  normalizeSectionTagPhrase,
  normalizeSectionTagPhrases,
} from '../../../shared/sectionTagPhrases.js';
import EditablePhraseListPreferencesPage from './EditablePhraseListPreferencesPage';

const SectionTagPhrasesPreferencesPage = (props) => (
  <EditablePhraseListPreferencesPage
    {...props}
    addButtonLabel="Add new phrase"
    deleteDescription="Lyrics using this phrase will no longer be recognized as section headings."
    description="Standalone, bracketed, numbered, and colon-suffixed versions of these phrases are recognized as section headings."
    emptyDescription="Add a phrase to recognize it as a section heading."
    emptyTitle="No recognized phrases"
    inputAriaNoun="section tag phrase"
    inputPlaceholder="Enter a section phrase"
    invalidValueMessage={`Use up to ${MAX_SECTION_TAG_PHRASE_LENGTH} letters, numbers, spaces, apostrophes, ampersands, slashes, or hyphens.`}
    maxLength={MAX_SECTION_TAG_PHRASE_LENGTH}
    normalizeValue={normalizeSectionTagPhrase}
    normalizeValues={normalizeSectionTagPhrases}
    onValuesChange={props.onPhrasesChange}
    title="Recognized Section Tags"
    values={props.phrases}
  />
);

export default SectionTagPhrasesPreferencesPage;
