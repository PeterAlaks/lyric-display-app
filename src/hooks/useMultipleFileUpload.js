import { useCallback } from 'react';
import { parseLyricsFileAsync } from '../utils/asyncLyricsParser';
import { useSetlistState } from './useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useToast from './useToast';
import { detectArtistFromFilename } from '../utils/artistDetection';

const useMultipleFileUpload = () => {
  const { setlistFiles, isSetlistFull, getAvailableSetlistSlots } = useSetlistState();
  const { emitSetlistAdd } = useControlSocket();
  const { showToast } = useToast();

  const MAX_FILE_SIZE_MB = 2;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleMultipleFileUpload = useCallback(async (files) => {
    try {
      if (!files || files.length === 0) return false;

      const availableSlots = getAvailableSetlistSlots();

      if (availableSlots === 0) {
        showToast({
          title: 'Setlist full',
          message: 'Cannot add files. Setlist has reached maximum capacity (50 files).',
          variant: 'error'
        });
        return false;
      }

      const validFiles = [];
      const invalidFiles = [];
      const oversizedFiles = [];

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          oversizedFiles.push(file.name);
          continue;
        }

        const nameLower = (file.name || '').toLowerCase();
        const isTxt = nameLower.endsWith('.txt');
        const isLrc = nameLower.endsWith('.lrc');

        if (!isTxt && !isLrc) {
          invalidFiles.push(file.name);
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        if (oversizedFiles.length > 0) {
          showToast({
            title: 'Files too large',
            message: `${oversizedFiles.length} file(s) exceed ${MAX_FILE_SIZE_MB}MB limit.`,
            variant: 'error'
          });
        } else if (invalidFiles.length > 0) {
          showToast({
            title: 'Unsupported files',
            message: 'Only .txt or .lrc files are supported.',
            variant: 'warn'
          });
        }
        return false;
      }

      const filesToAdd = Math.min(validFiles.length, availableSlots);
      const filesToProcess = validFiles.slice(0, filesToAdd);

      const processedFiles = [];
      const failedFiles = [];

      for (const file of filesToProcess) {
        try {
          const nameLower = file.name.toLowerCase();
          const isLrc = nameLower.endsWith('.lrc');

          const parsed = await parseLyricsFileAsync(file, {
            fileType: isLrc ? 'lrc' : 'txt'
          });

          if (!parsed || !Array.isArray(parsed.processedLines)) {
            failedFiles.push(file.name);
            continue;
          }

          const baseName = file.name.replace(/\.(txt|lrc)$/i, '');
          const detected = detectArtistFromFilename(baseName);

          const metadata = {
            title: detected.title || baseName,
            artists: detected.artist ? [detected.artist] : [],
            album: null,
            year: null,
            lyricLines: parsed.processedLines.length,
            origin: isLrc ? 'Local (.lrc)' : 'Local (.txt)',
            filePath: file?.path || null
          };

          let rawContent;
          if (isLrc) {
            try {
              rawContent = await file.text();
            } catch {
              rawContent = parsed.rawText;
            }
          } else {
            rawContent = parsed.rawText;
          }

          processedFiles.push({
            name: file.name,
            content: rawContent,
            lastModified: file.lastModified || Date.now(),
            metadata: metadata
          });
        } catch (err) {
          console.error(`Failed to process file ${file.name}:`, err);
          failedFiles.push(file.name);
        }
      }

      if (processedFiles.length === 0) {
        showToast({
          title: 'Failed to process files',
          message: 'Could not process any of the selected files.',
          variant: 'error'
        });
        return false;
      }

      const emitted = emitSetlistAdd(processedFiles);
      if (!emitted) {
        showToast({
          title: 'Failed to add to setlist',
          message: 'Unable to add files. Check your connection and try again.',
          variant: 'error'
        });
        return false;
      }

      if (failedFiles.length > 0 || validFiles.length > filesToAdd) {
        let message = '';

        if (failedFiles.length > 0) {
          message = `${failedFiles.length} file${failedFiles.length > 1 ? 's' : ''} failed to process`;
        }

        if (validFiles.length > filesToAdd) {
          if (message) message += '. ';
          message += `${validFiles.length - filesToAdd} file${validFiles.length - filesToAdd > 1 ? 's' : ''} skipped (setlist limit reached)`;
        }

        if (message) {
          showToast({
            title: 'Note',
            message,
            variant: 'warn'
          });
        }
      }

      return true;
    } catch (err) {
      console.error('Failed to process multiple files:', err);
      showToast({
        title: 'Failed to add files',
        message: 'An error occurred while processing the files.',
        variant: 'error'
      });
      return false;
    }
  }, [emitSetlistAdd, getAvailableSetlistSlots, showToast]);

  return handleMultipleFileUpload;
};

export default useMultipleFileUpload;