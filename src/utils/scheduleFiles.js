import { extractLyricTextFromSource } from '../../shared/documentTextExtraction.js';
import {
  parseScheduleDocument,
  parseScheduleText,
  serializeScheduleDocument,
} from '../../shared/scheduleUtils.js';

const MAX_SCHEDULE_FILE_BYTES = 5 * 1024 * 1024;
export const SCHEDULE_FILE_ACCEPT = '.ldsch,.txt,.md,.markdown,.rtf,.docx';

const getExtension = (name = '') => {
  const match = String(name).toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] || '';
};

const fileTypeForExtension = (extension) => {
  if (extension === 'markdown') return 'md';
  return extension;
};

export async function importScheduleFile(file) {
  if (!file || typeof file.name !== 'string') throw new Error('Choose a schedule file to import');
  if (Number(file.size) > MAX_SCHEDULE_FILE_BYTES) throw new Error('Schedule file must be 5 MB or smaller');
  const extension = getExtension(file.name);
  if (!SCHEDULE_FILE_ACCEPT.split(',').includes(`.${extension}`)) {
    throw new Error('Choose an .ldsch, .txt, .md, .rtf, or .docx file');
  }

  if (extension === 'ldsch') {
    const schedule = parseScheduleDocument(await file.text());
    return {
      schedule,
      confidence: 1,
      confidenceLabel: 'exact',
      warnings: [],
      ignoredLines: [],
      stats: {
        itemCount: schedule.items.length,
        timedCount: schedule.items.filter((item) => item.timed).length,
        manualCount: schedule.items.filter((item) => !item.timed).length,
        inferredDurationCount: 0,
      },
      sourceName: file.name,
      sourceType: 'ldsch',
    };
  }

  const fileType = fileTypeForExtension(extension);
  let extractedText;
  if (fileType === 'txt' || fileType === 'md') {
    extractedText = await file.text();
  } else {
    extractedText = await extractLyricTextFromSource({
      fileType,
      fileName: file.name,
      rawBytes: await file.arrayBuffer(),
    });
  }
  const parsed = parseScheduleText(extractedText, {
    title: file.name.replace(/\.[^.]+$/, ''),
  });
  if (parsed.schedule.items.length === 0) throw new Error(parsed.warnings[0] || 'No schedule items were found');
  return { ...parsed, sourceName: file.name, sourceType: fileType };
}

const sanitizeFileBase = (value, fallback = 'Service Schedule') => {
  const safe = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/[. ]+$/g, '')
    .trim();
  return safe || fallback;
};

export async function downloadScheduleFile(schedule) {
  const content = serializeScheduleDocument(schedule);
  const fileName = `${sanitizeFileBase(schedule?.title)}.ldsch`;

  if (window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
    const result = await window.electronAPI.showSaveDialog({
      title: 'Save LyricDisplay Schedule',
      defaultPath: fileName,
      filters: [{ name: 'LyricDisplay Schedule', extensions: ['ldsch'] }],
    });
    if (result?.canceled || !result?.filePath) return { canceled: true };
    const writeResult = await window.electronAPI.writeFile(result.filePath, content);
    if (!writeResult?.success) throw new Error(writeResult?.error || 'Could not save the schedule');
    return { success: true, filePath: result.filePath };
  }

  const blob = new Blob([content], { type: 'application/x-lyricdisplay-schedule+json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return { success: true };
}
