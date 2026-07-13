import { createNormalGroup } from './helpers.js';

export const GROUPING_PLAN_VERSION = 1;

const MAX_PLAN_LINES = 50_000;

function createTranslationGroup(mainLine, translation, originalIndex) {
  return {
    type: 'group',
    id: `group_plan_${originalIndex}`,
    mainLine,
    translation,
    displayText: `${mainLine}\n${translation}`,
    searchText: `${mainLine} ${translation}`,
    originalIndex,
  };
}

function flattenProcessedLines(processedLines = []) {
  const lines = [];
  const groups = [];

  for (const item of processedLines) {
    const start = lines.length;

    if (typeof item === 'string') {
      lines.push(item);
      continue;
    }

    if (item?.type === 'normal-group') {
      const groupLines = Array.isArray(item.lines)
        ? item.lines
        : [item.line1, item.line2];
      const normalized = groupLines.filter((line) => typeof line === 'string');
      if (normalized.length === 0) return null;
      lines.push(...normalized);
      groups.push({ type: 'normal-group', start, count: normalized.length });
      continue;
    }

    if (
      item?.type === 'group'
      && typeof item.mainLine === 'string'
      && typeof item.translation === 'string'
    ) {
      lines.push(item.mainLine, item.translation);
      groups.push({ type: 'group', start, count: 2 });
      continue;
    }

    return null;
  }

  return lines.length <= MAX_PLAN_LINES ? { lines, groups } : null;
}

export function createGroupingPlan(processedLines = []) {
  if (!Array.isArray(processedLines)) return null;
  const flattened = flattenProcessedLines(processedLines);
  if (!flattened) return null;

  return {
    version: GROUPING_PLAN_VERSION,
    lines: flattened.lines,
    groups: flattened.groups,
  };
}

function validateGroupingPlan(plan) {
  if (
    !plan
    || plan.version !== GROUPING_PLAN_VERSION
    || !Array.isArray(plan.lines)
    || !Array.isArray(plan.groups)
    || plan.lines.length > MAX_PLAN_LINES
    || plan.lines.some((line) => typeof line !== 'string')
  ) {
    return false;
  }

  let previousEnd = 0;
  return plan.groups.every((group) => {
    const validType = group?.type === 'normal-group' || group?.type === 'group';
    const start = Number(group?.start);
    const count = Number(group?.count);
    const validCount = group?.type === 'group' ? count === 2 : count >= 2 && count <= 12;
    const end = start + count;
    const valid = validType
      && Number.isInteger(start)
      && Number.isInteger(count)
      && start >= previousEnd
      && validCount
      && end <= plan.lines.length;
    if (valid) previousEnd = end;
    return valid;
  });
}

/**
 * Reapply app-owned presentation grouping only when the parsed lyric lines still
 * exactly match the content the plan was created for.
 */
export function applyGroupingPlan(processedLines = [], plan = null) {
  if (!Array.isArray(processedLines) || !validateGroupingPlan(plan)) {
    return { processedLines, applied: false };
  }

  const current = flattenProcessedLines(processedLines);
  if (
    !current
    || current.lines.length !== plan.lines.length
    || current.lines.some((line, index) => line !== plan.lines[index])
  ) {
    return { processedLines, applied: false };
  }

  const groupsByStart = new Map(plan.groups.map((group) => [group.start, group]));
  const rebuilt = [];
  let index = 0;

  while (index < plan.lines.length) {
    const group = groupsByStart.get(index);
    if (!group) {
      rebuilt.push(plan.lines[index]);
      index += 1;
      continue;
    }

    const groupLines = plan.lines.slice(index, index + group.count);
    if (group.type === 'group') {
      rebuilt.push(createTranslationGroup(groupLines[0], groupLines[1], index));
    } else {
      rebuilt.push(createNormalGroup(groupLines, 'normal_group_plan', index));
    }
    index += group.count;
  }

  return { processedLines: rebuilt, applied: true };
}
