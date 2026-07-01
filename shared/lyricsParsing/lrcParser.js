import { ENHANCED_TIME_TAG_REGEX, META_TAG_REGEX, TIME_TAG_REGEX } from './constants.js';
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
      result.push({ text: '', t: entry.t, enhancedTimestamps: entry.enhancedTimestamps || [] });
      continue;
    }

    if (isTranslationLine(trimmed)) {
      result.push({ text: trimmed, t: entry.t, enhancedTimestamps: entry.enhancedTimestamps || [] });
      continue;
    }

    const nextEntry = entries[i + 1];
    const nextIsTrans = nextEntry && isTranslationLine(String(nextEntry.text || '').trim());

    if (nextIsTrans || (Array.isArray(entry.enhancedTimestamps) && entry.enhancedTimestamps.length > 0)) {
      result.push({ text: trimmed, t: entry.t, enhancedTimestamps: entry.enhancedTimestamps || [] });
      continue;
    }

    const segments = splitLongLine(trimmed, splitConfig);
    segments.forEach((seg) => result.push({ text: seg, t: entry.t, enhancedTimestamps: [] }));
  }

  return result;
}

function parseTimeMatch(match) {
  const mm = parseInt(match?.[1], 10) || 0;
  const ss = parseInt(match?.[2], 10) || 0;
  const cs = match?.[3] ? parseInt(match[3].slice(0, 2).padEnd(2, '0'), 10) : 0;
  return mm * 60 * 100 + ss * 100 + cs;
}

function stripEnhancedTimestamps(text = '') {
  const enhancedTimestamps = [];
  let match;

  ENHANCED_TIME_TAG_REGEX.lastIndex = 0;
  while ((match = ENHANCED_TIME_TAG_REGEX.exec(text)) !== null) {
    const afterMarker = text.slice(ENHANCED_TIME_TAG_REGEX.lastIndex);
    const wordMatch = afterMarker.match(/^\s*(\S+)/);
    enhancedTimestamps.push({
      time: parseTimeMatch(match),
      text: wordMatch?.[1] || '',
    });
  }

  ENHANCED_TIME_TAG_REGEX.lastIndex = 0;
  return {
    text: text.replace(ENHANCED_TIME_TAG_REGEX, '').trim(),
    enhancedTimestamps,
  };
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
        times.push(parseTimeMatch(match));
      }

      const stripped = stripEnhancedTimestamps(line.replace(TIME_TAG_REGEX, '').trim());
      let text = stripped.text;
      text = preprocessText(text);
      const enhancedTimestamps = stripped.enhancedTimestamps;

      if (!text && times.length === 0 && enhancedTimestamps.length === 0) continue;

      if (times.length === 0) {
        const firstEnhancedTimestamp = enhancedTimestamps.length > 0 ? enhancedTimestamps[0].time : null;
        entries.push({ t: firstEnhancedTimestamp, text, enhancedTimestamps });
      } else {
        times.forEach((t) => entries.push({ t, text, enhancedTimestamps }));
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
      const enhancedKey = JSON.stringify(entry.enhancedTimestamps || []);
      const key = `${entry.t}|${entry.text}|${enhancedKey}`;
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
    const groupedEnhancedTimestamps = [];
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
        groupedEnhancedTimestamps.push({
          main: main.enhancedTimestamps || [],
          translation: next.enhancedTimestamps || [],
        });
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
          groupedEnhancedTimestamps.push(
            splitEntries.slice(i, i + groupedLines.length).map((candidate) => candidate.enhancedTimestamps || [])
          );
          i += groupedLines.length - 1;
        } else {
          grouped.push(main.text);
          groupedTimestamps.push(groupTimestamp);
          groupedEnhancedTimestamps.push(main.enhancedTimestamps || []);
        }
      } else {
        grouped.push(main.text);
        groupedTimestamps.push(main.t !== undefined ? main.t : null);
        groupedEnhancedTimestamps.push(main.enhancedTimestamps || []);
      }
    }

    const visibleRawText = splitEntries.map((entry) => entry.text).join('\n');
    const { sections, lineToSection } = deriveSectionsFromProcessedLines(grouped);
    return {
      rawText: visibleRawText,
      processedLines: grouped,
      timestamps: groupedTimestamps,
      enhancedTimestamps: groupedEnhancedTimestamps,
      sections,
      lineToSection
    };
  } finally {
    clearRuntimeGroupingConfig();
  }
}
