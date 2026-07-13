import { preprocessText, splitLongLine } from './lineSplitting.js';
import { stripTimestampPatterns } from './textCleanup.js';
import { extractStructureTags } from './structureTags.js';
import { expandRepeatableSectionReferences } from './repeatableSections.js';
import { isTranslationLine } from './translation.js';
import { flattenClusters, mergeAcrossBlankLines } from './grouping.js';
import { normalizeLineSplittingConfig } from './preferenceOptions.js';

/**
 * Split raw text into clusters separated by blank lines and convert into processed lyric lines.
 * Enhanced with intelligent line splitting.
 * @param {string} rawText
 * @param {object} options - { enableSplitting: boolean, splitConfig: object }
 * @returns {Array<string | object>}
 */
export function processRawTextToLines(rawText = '', options = {}) {
  const { enableSplitting = true, splitConfig = {} } = options;
  const normalizedSplitConfig = normalizeLineSplittingConfig(splitConfig);

  let cleaned = preprocessText(rawText);
  cleaned = stripTimestampPatterns(cleaned);
  cleaned = extractStructureTags(cleaned);
  cleaned = expandRepeatableSectionReferences(cleaned);
  const allLines = cleaned.split(/\r?\n/);
  const preClusters = [];
  let currentCluster = [];

  for (let i = 0; i < allLines.length; i += 1) {
    const line = allLines[i].trim();

    if (line.length > 0) {
      currentCluster.push(line);
    } else if (currentCluster.length > 0) {
      preClusters.push([...currentCluster]);
      currentCluster = [];
    }
  }

  if (currentCluster.length > 0) {
    preClusters.push(currentCluster);
  }

  const finalClusters = [];

  for (let clusterIndex = 0; clusterIndex < preClusters.length; clusterIndex += 1) {
    const cluster = preClusters[clusterIndex];
    const processedCluster = [];

    for (let i = 0; i < cluster.length; i += 1) {
      const line = cluster[i];

      if (isTranslationLine(line)) {
        processedCluster.push({ line });
        continue;
      }

      const nextIsTranslation = isTranslationLine(cluster[i + 1]);
      if (enableSplitting && !nextIsTranslation && line.length > normalizedSplitConfig.MAX_LENGTH) {
        const segments = splitLongLine(line, normalizedSplitConfig);
        const splitSourceId = `txt_split_${clusterIndex}_${i}`;
        for (let j = 0; j < segments.length; j += 1) {
          processedCluster.push({
            line: segments[j],
            ...(segments.length > 1 ? {
              splitSourceId,
              splitSegmentIndex: j,
              splitSegmentCount: segments.length,
            } : {}),
          });
        }
      } else {
        processedCluster.push({ line });
      }
    }

    const indexedCluster = processedCluster.map((item, idx) => ({
      ...item,
      originalIndex: idx,
    }));

    finalClusters.push(indexedCluster);
  }

  const clusteredResult = flattenClusters(finalClusters);
  return mergeAcrossBlankLines(clusteredResult);
}
