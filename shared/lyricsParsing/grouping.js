import { getEffectiveGroupingConfig, sanitizeMaxLinesPerGroup } from './runtimeConfig.js';
import { isTranslationLine } from './translation.js';
import { isStructureTag } from './structureTags.js';
import { isNormalGroupCandidate } from './normalGroupCandidates.js';
import { createNormalGroup } from './helpers.js';
import { isSongSeparator } from './separators.js';

const PROTECTED_SPLIT_LINE_TYPE = 'parser-protected-split-line';
const protectSplitLine = (line) => ({ type: PROTECTED_SPLIT_LINE_TYPE, line });
const isProtectedSplitLine = (item) => item?.type === PROTECTED_SPLIT_LINE_TYPE;
const unwrapProtectedSplitLine = (item) => isProtectedSplitLine(item) ? item.line : item;

/**
 * Groups clusters of raw lines into either individual strings, translation groups, or normal groups.
 * Handles both translation grouping (bracketed) and normal grouping (two-line pairs).
 * @param {Array<{ line: string, originalIndex: number }[]>} clusters
 * @returns {Array<string | object>}
 */
export function flattenClusters(clusters) {
  const result = [];
  const config = getEffectiveGroupingConfig();
  const enableTranslationGrouping = config.enableTranslationGrouping;
  const enableAutoLineGrouping = config.enableAutoLineGrouping;
  const maxLinesPerGroup = sanitizeMaxLinesPerGroup(config.maxLinesPerGroup);

  clusters.forEach((cluster, clusterIndex) => {
    // Translation grouping for 2-line clusters (only if enabled)
    if (
      enableTranslationGrouping &&
      cluster.length === 2 &&
      isTranslationLine(cluster[1].line) &&
      !isTranslationLine(cluster[0].line) &&
      !isStructureTag(cluster[0].line) &&
      !isStructureTag(cluster[1].line)
    ) {
      result.push({
        type: 'group',
        id: `group_${clusterIndex}_${cluster[0].originalIndex}`,
        mainLine: cluster[0].line,
        translation: cluster[1].line,
        displayText: `${cluster[0].line}\n${cluster[1].line}`,
        searchText: `${cluster[0].line} ${cluster[1].line}`,
        originalIndex: cluster[0].originalIndex,
      });
      return;
    }

    // Process clusters with 2+ lines - handle both translation and normal grouping
    if (cluster.length >= 2 && (enableAutoLineGrouping || enableTranslationGrouping)) {
      let i = 0;
      while (i < cluster.length) {
        const currentItem = cluster[i];
        const nextItem = cluster[i + 1];

        if (currentItem.splitSourceId) {
          const splitItems = [];
          let splitIndex = i;
          while (
            splitIndex < cluster.length
            && cluster[splitIndex].splitSourceId === currentItem.splitSourceId
          ) {
            splitItems.push(cluster[splitIndex]);
            splitIndex += 1;
          }

          const splitItemsAreEligible = splitItems.every((item) => (
            isNormalGroupCandidate(item.line, config)
            && !isStructureTag(item.line)
            && !isTranslationLine(item.line)
          ));

          if (enableAutoLineGrouping && splitItemsAreEligible) {
            for (let offset = 0; offset < splitItems.length; offset += maxLinesPerGroup) {
              const chunk = splitItems.slice(offset, offset + maxLinesPerGroup);
              if (chunk.length >= 2) {
                result.push(createNormalGroup(
                  chunk.map((item) => item.line),
                  `split_group_${clusterIndex}`,
                  chunk[0].originalIndex
                ));
              } else {
                result.push(protectSplitLine(chunk[0].line));
              }
            }
          } else {
            splitItems.forEach((item) => result.push(protectSplitLine(item.line)));
          }

          i = splitIndex;
          continue;
        }

        // Translation grouping within clusters (only if enabled)
        if (
          enableTranslationGrouping &&
          nextItem &&
          isTranslationLine(nextItem.line) &&
          !isTranslationLine(currentItem.line) &&
          !isStructureTag(currentItem.line) &&
          !isStructureTag(nextItem.line)
        ) {
          result.push({
            type: 'group',
            id: `group_${clusterIndex}_${currentItem.originalIndex}`,
            mainLine: currentItem.line,
            translation: nextItem.line,
            displayText: `${currentItem.line}\n${nextItem.line}`,
            searchText: `${currentItem.line} ${nextItem.line}`,
            originalIndex: currentItem.originalIndex,
          });
          i += 2;
          continue;
        }

        // Normal grouping (only if enabled)
        if (
          enableAutoLineGrouping &&
          isNormalGroupCandidate(currentItem.line, config) &&
          !isStructureTag(currentItem.line)
        ) {
          const groupedLines = [];
          let j = i;
          while (j < cluster.length && groupedLines.length < maxLinesPerGroup) {
            const candidate = cluster[j];
            const candidateLine = candidate?.line;
            const candidateNext = cluster[j + 1];

            if (
              !candidate ||
              !isNormalGroupCandidate(candidateLine, config) ||
              isStructureTag(candidateLine) ||
              isTranslationLine(candidateLine)
            ) {
              break;
            }

            const followedByTranslation = Boolean(
              enableTranslationGrouping &&
              candidateNext &&
              !isStructureTag(candidateNext.line) &&
              isTranslationLine(candidateNext.line)
            );
            if (followedByTranslation) {
              break;
            }

            groupedLines.push(candidateLine);
            j += 1;
          }

          if (groupedLines.length >= 2) {
            result.push(
              createNormalGroup(groupedLines, `normal_group_${clusterIndex}`, currentItem.originalIndex)
            );
            i += groupedLines.length;
            continue;
          }
        }

        result.push(currentItem.line);
        i += 1;
      }
    } else {
      cluster.forEach((item) => {
        result.push(item.splitSourceId ? protectSplitLine(item.line) : item.line);
      });
    }
  });

  return result;
}

/**
 * Merge eligible single-line items across blank line boundaries.
 * Only merges consecutive standalone strings that are both normal group candidates.
 * Preserves all existing groups and multi-line structures.
 * Excludes structure tags from grouping.
 * @param {Array<string | object>} processedLines
 * @returns {Array<string | object>}
 */
export function mergeAcrossBlankLines(processedLines) {
  const config = getEffectiveGroupingConfig();
  const maxLinesPerGroup = sanitizeMaxLinesPerGroup(config.maxLinesPerGroup);

  if (!config.enableAutoLineGrouping || !config.enableCrossBlankLineGrouping) {
    return processedLines.map(unwrapProtectedSplitLine);
  }

  const result = [];
  let i = 0;

  while (i < processedLines.length) {
    const current = processedLines[i];
    if (isProtectedSplitLine(current)) {
      result.push(current.line);
      i += 1;
      continue;
    }
    const currentIsString = typeof current === 'string';
    const currentIsStructureTag = currentIsString && isStructureTag(current);
    const currentIsSongSeparator = currentIsString && isSongSeparator(current);

    if (
      currentIsString &&
      !currentIsStructureTag &&
      !currentIsSongSeparator &&
      isNormalGroupCandidate(current, config)
    ) {
      const groupedLines = [];
      let j = i;
      while (j < processedLines.length && groupedLines.length < maxLinesPerGroup) {
        const candidate = processedLines[j];
        if (typeof candidate !== 'string') break;
        if (isStructureTag(candidate) || isSongSeparator(candidate)) break;
        if (!isNormalGroupCandidate(candidate, config)) break;
        groupedLines.push(candidate);
        j += 1;
      }

      if (groupedLines.length >= 2) {
        result.push(createNormalGroup(groupedLines, 'cross_blank_group', i));
        i += groupedLines.length;
        continue;
      }
    }

    result.push(current);
    i += 1;
  }

  return result.map(unwrapProtectedSplitLine);
}
