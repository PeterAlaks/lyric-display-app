import { META_TAG_REGEX, TIME_TAG_REGEX } from './constants.js';
import { preprocessText, splitLongLine } from './lineSplitting.js';
import {
  clearRuntimeGroupingConfig,
  getEffectiveGroupingConfig,
  sanitizeMaxLinesPerGroup,
  setRuntimeGroupingConfig
} from './runtimeConfig.js';
import { isTranslationLine } from './translation.js';
import { isStructureTag } from './structureTags.js';
import { isNormalGroupCandidate } from './normalGroupCandidates.js';
import { createNormalGroup } from './helpers.js';
import { deriveSectionsFromProcessedLines } from './sections.js';

/**
 * Apply intelligent line splitting while keeping timestamp association intact.
 * @param {{ text: string, t: number|null }[]} entries
 * @param {object} options
 * @returns {{ text: string, t: number|null }[]}
 */
function applyIntelligentSplittingWithTimestamps(entries = [], options = {}) {
  const { enableSplitting = true, splitConfig = {} } = options;

  if (!enableSplitting) return entries;

  const result = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry || typeof entry.text !== 'string') continue;

    const trimmed = entry.text.trim();
    if (!trimmed) {
      result.push({ text: '', t: entry.t });
      continue;
    }

    if (isTranslationLine(trimmed)) {
      result.push({ text: trimmed, t: entry.t });
      continue;
    }

    const nextEntry = entries[i + 1];
    const nextIsTrans = nextEntry && isTranslationLine(String(nextEntry.text || '').trim());

    if (nextIsTrans) {
      result.push({ text: trimmed, t: entry.t });
      continue;
    }

    const segments = splitLongLine(trimmed, splitConfig);
    segments.forEach((seg) => result.push({ text: seg, t: entry.t }));
  }

  return result;
}

/**
 * Parse LRC content into visible lyric lines preserving ordering and translation groupings.
 * Enhanced with intelligent line splitting.
 * @param {string} rawText
 * @param {object} options - { enableSplitting: boolean, splitConfig: object, groupingConfig: object }
 * @returns {{ rawText: string, processedLines: Array<string | object>, timestamps: Array<number | null> }}
 */
export function parseLrcContent(rawText = '', options = {}) {
  const { enableSplitting = true, splitConfig = {}, groupingConfig } = options;

  if (groupingConfig) {
    setRuntimeGroupingConfig(groupingConfig);
  }

  try {
    const lines = String(rawText).split(/\r?\n/);
    const entries = [];

    for (const line of lines) {
      if (!line?.trim()) continue;
      if (META_TAG_REGEX.test(line)) continue;

      let match;
      const times = [];
      TIME_TAG_REGEX.lastIndex = 0;

      while ((match = TIME_TAG_REGEX.exec(line)) !== null) {
        const mm = parseInt(match[1], 10) || 0;
        const ss = parseInt(match[2], 10) || 0;
        const cs = match[3] ? parseInt(match[3].slice(0, 2).padEnd(2, '0'), 10) : 0;
        const t = mm * 60 * 100 + ss * 100 + cs;
        times.push(t);
      }

      let text = line.replace(TIME_TAG_REGEX, '').trim();
      text = preprocessText(text);

      if (!text && times.length === 0) continue;

      if (times.length === 0) {
        entries.push({ t: null, text });
      } else {
        times.forEach((t) => entries.push({ t, text }));
      }
    }

    entries.sort((a, b) => {
      if (a.t === null && b.t === null) return 0;
      if (a.t === null) return 1;
      if (b.t === null) return -1;
      return a.t - b.t;
    });

    const uniqueEntries = [];
    const seen = new Set();
    for (const entry of entries) {
      const key = `${entry.t}|${entry.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueEntries.push(entry);
    }

    const splitEntries = applyIntelligentSplittingWithTimestamps(uniqueEntries, { enableSplitting, splitConfig });

    const config = getEffectiveGroupingConfig();
    const enableTranslationGrouping = config.enableTranslationGrouping;
    const enableAutoLineGrouping = config.enableAutoLineGrouping;
    const maxLinesPerGroup = sanitizeMaxLinesPerGroup(config.maxLinesPerGroup);

    const grouped = [];
    const groupedTimestamps = [];
    for (let i = 0; i < splitEntries.length; i += 1) {
      const main = splitEntries[i];
      const next = splitEntries[i + 1];
      const nextIsTranslation = next && isTranslationLine(next.text);
      const sameTimestamp = next && main.t === next.t;

      if (enableTranslationGrouping && next && nextIsTranslation && !isTranslationLine(main.text) && sameTimestamp) {
        grouped.push({
          type: 'group',
          id: `lrc_group_${i}`,
          mainLine: main.text,
          translation: next.text,
          displayText: `${main.text}\n${next.text}`,
          searchText: `${main.text} ${next.text}`,
          originalIndex: i,
        });
        groupedTimestamps.push(main.t !== undefined ? main.t : null);
        i += 1;
      } else if (
        enableAutoLineGrouping &&
        !isTranslationLine(main.text) &&
        !isStructureTag(main.text) &&
        isNormalGroupCandidate(main.text, config)
      ) {
        const groupedLines = [];
        const groupTimestamp = main.t !== undefined ? main.t : null;
        let j = i;

        while (j < splitEntries.length && groupedLines.length < maxLinesPerGroup) {
          const candidate = splitEntries[j];
          const candidateNext = splitEntries[j + 1];
          if (!candidate) break;
          if (candidate.t !== main.t) break;
          if (
            isTranslationLine(candidate.text) ||
            isStructureTag(candidate.text) ||
            !isNormalGroupCandidate(candidate.text, config)
          ) {
            break;
          }

          const followedByTranslation = Boolean(
            enableTranslationGrouping &&
            candidateNext &&
            candidateNext.t === candidate.t &&
            isTranslationLine(candidateNext.text)
          );
          if (followedByTranslation) {
            break;
          }

          groupedLines.push(candidate.text);
          j += 1;
        }

        if (groupedLines.length >= 2) {
          grouped.push(createNormalGroup(groupedLines, 'lrc_normal_group', i));
          groupedTimestamps.push(groupTimestamp);
          i += groupedLines.length - 1;
        } else {
          grouped.push(main.text);
          groupedTimestamps.push(groupTimestamp);
        }
      } else {
        grouped.push(main.text);
        groupedTimestamps.push(main.t !== undefined ? main.t : null);
      }
    }

    const visibleRawText = splitEntries.map((entry) => entry.text).join('\n');
    const { sections, lineToSection } = deriveSectionsFromProcessedLines(grouped);
    return { rawText: visibleRawText, processedLines: grouped, timestamps: groupedTimestamps, sections, lineToSection };
  } finally {
    clearRuntimeGroupingConfig();
  }
}
