import { NORMAL_GROUP_CONFIG, STRUCTURE_TAGS_CONFIG } from './constants.js';
import {
  DEFAULT_SECTION_TAG_PHRASES,
  normalizeSectionTagPhrases,
} from '../sectionTagPhrases.js';

// Runtime config that can be set per-parse operation
let runtimeGroupingConfig = null;

/**
 * Set runtime grouping configuration for the current parse operation
 * @param {object} config
 */
export function setRuntimeGroupingConfig(config) {
  runtimeGroupingConfig = config;
}

/**
 * Clear runtime grouping configuration
 */
export function clearRuntimeGroupingConfig() {
  runtimeGroupingConfig = null;
}

/**
 * Get effective grouping config (runtime overrides defaults)
 */
export function getEffectiveGroupingConfig() {
  if (!runtimeGroupingConfig) {
    return {
      enableAutoLineGrouping: NORMAL_GROUP_CONFIG.ENABLED,
      enableTranslationGrouping: true,
      maxLineLength: NORMAL_GROUP_CONFIG.MAX_LINE_LENGTH,
      enableCrossBlankLineGrouping: NORMAL_GROUP_CONFIG.CROSS_BLANK_LINE_GROUPING,
      maxLinesPerGroup: NORMAL_GROUP_CONFIG.MAX_LINES_PER_GROUP,
      structureTagMode: STRUCTURE_TAGS_CONFIG.MODE,
      sectionTagPhrases: [...DEFAULT_SECTION_TAG_PHRASES],
    };
  }
  return {
    enableAutoLineGrouping: runtimeGroupingConfig.enableAutoLineGrouping ?? NORMAL_GROUP_CONFIG.ENABLED,
    enableTranslationGrouping: runtimeGroupingConfig.enableTranslationGrouping ?? true,
    maxLineLength: runtimeGroupingConfig.maxLineLength ?? NORMAL_GROUP_CONFIG.MAX_LINE_LENGTH,
    enableCrossBlankLineGrouping: runtimeGroupingConfig.enableCrossBlankLineGrouping ?? NORMAL_GROUP_CONFIG.CROSS_BLANK_LINE_GROUPING,
    maxLinesPerGroup: runtimeGroupingConfig.maxLinesPerGroup ?? NORMAL_GROUP_CONFIG.MAX_LINES_PER_GROUP,
    structureTagMode: runtimeGroupingConfig.structureTagMode ?? STRUCTURE_TAGS_CONFIG.MODE,
    sectionTagPhrases: normalizeSectionTagPhrases(runtimeGroupingConfig.sectionTagPhrases),
  };
}

export function sanitizeMaxLinesPerGroup(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 2) return NORMAL_GROUP_CONFIG.MAX_LINES_PER_GROUP;
  return Math.min(parsed, 12);
}
