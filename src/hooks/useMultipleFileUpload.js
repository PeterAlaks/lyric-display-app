import { useCallback } from 'react';
import { DEFAULT_SETLIST_ITEMS } from '../../shared/setlistLimits.js';
import { parseLyricsFileAsync } from '../utils/asyncLyricsParser';
import { useSetlistState } from './useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useToast from './useToast';
import { detectArtistFromFilename } from '../utils/artistDetection';
import {
  getLyricImportFormatForName,
  getLyricOriginLabel,
  stripLyricImportExtension,
} from '../../shared/lyricImportRegistry.js';

const useMultipleFileUpload = () => {
  const { getAvailableSetlistSlots, maxFileSizeLimit, maxSetlistFilesLimit } = useSetlistState();
  const { emitSetlistAdd } = useControlSocket();
  const { showToast } = useToast();
  const maxFileSize = maxFileSizeLimit ?? 2;
  const maxSetlistFiles = maxSetlistFilesLimit ?? DEFAULT_SETLIST_ITEMS;

  const MAX_FILE_SIZE_BYTES = maxFileSize * 1024 * 1024;

  const handleMultipleFileUpload = useCallback(async (files) => {
    try {
      if (!files || files.length === 0) return false;

      const availableSlots = getAvailableSetlistSlots();

      if (availableSlots === 0) {
        showToast({
          title: 'Setlist full',
          message: `Cannot add files. Setlist has reached maximum capacity (${maxSetlistFiles} files).`,
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

        if (!getLyricImportFormatForName(file.name || '')) {
          invalidFiles.push(file.name);
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        if (oversizedFiles.length > 0) {
          showToast({
            title: 'Files too large',
            message: `${oversizedFiles.length} file(s) exceed ${maxFileSize}MB limit.`,
            variant: 'error'
          });
        } else if (invalidFiles.length > 0) {
          showToast({
            title: 'Unsupported files',
            message: 'Supported lyric files: .txt, .lrc, .md, .markdown, .rtf, .docx.',
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
          const format = getLyricImportFormatForName(file.name || '');
          const fileType = format?.fileType || 'txt';
          const isLrc = fileType === 'lrc';

          const parsed = await parseLyricsFileAsync(file, {
            fileType
          });

          if (!parsed || !Array.isArray(parsed.processedLines)) {
            failedFiles.push(file.name);
            continue;
          }

          const baseName = stripLyricImportExtension(file.name);
          const detected = detectArtistFromFilename(baseName);

          const metadata = {
            title: detected.title || baseName,
            artists: detected.artist ? [detected.artist] : [],
            album: null,
            year: null,
            lyricLines: parsed.processedLines.length,
            origin: getLyricOriginLabel(fileType),
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
            fileType,
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
  }, [emitSetlistAdd, getAvailableSetlistSlots, showToast, maxFileSize, maxSetlistFiles, MAX_FILE_SIZE_BYTES]);

  return handleMultipleFileUpload;
};

export default useMultipleFileUpload;
