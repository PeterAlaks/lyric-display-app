import { dialog } from 'electron';
import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';

const REQUIRED_DB_FILES = ['Songs.db', 'SongWords.db'];

/**
 * Validates if the given path contains required EasyWorship database files
 * @param {string} dbPath - Path to database folder
 * @returns {Promise<{success: boolean, songs?: Array, error?: string}>}
 */
export async function validateDatabasePath(dbPath) {
    try {
        try {
            await fs.access(dbPath);
        } catch {
            return { success: false, error: 'Path does not exist' };
        }

        const filesInDir = await fs.readdir(dbPath);
        const hasRequiredFiles = REQUIRED_DB_FILES.every(file =>
            filesInDir.includes(file)
        );

        if (!hasRequiredFiles) {
            return {
                success: false,
                error: `Required database files not found. Looking for: ${REQUIRED_DB_FILES.join(', ')}`
            };
        }

        const songs = await readSongsFromDatabase(dbPath);

        return {
            success: true,
            songs
        };
    } catch (error) {
        console.error('Database validation error:', error);
        return {
            success: false,
            error: error.message || 'Failed to validate database'
        };
    }
}

/**
 * Reads songs from EasyWorship database
 * @param {string} dbPath - Path to database folder
 * @returns {Promise<Array>}
 */
async function readSongsFromDatabase(dbPath) {
    const songsDbPath = path.join(dbPath, 'Songs.db');
    const wordsDbPath = path.join(dbPath, 'SongWords.db');

    let songsDb = null;
    let wordsDb = null;

    try {
        songsDb = new Database(songsDbPath, { readonly: true, fileMustExist: true });
        wordsDb = new Database(wordsDbPath, { readonly: true, fileMustExist: true });

        const songRows = songsDb.prepare(`
      SELECT rowid, song_uid, title, author, copyright, administrator
      FROM song
    `).all();

        const songs = [];

        for (const row of songRows) {
            try {
                const wordRow = wordsDb.prepare(`
          SELECT words
          FROM word
          WHERE song_id = ?
        `).get(row.rowid);

                if (wordRow && wordRow.words) {
                    songs.push({
                        id: row.song_uid || String(row.rowid),
                        rowid: row.rowid,
                        title: row.title || 'Untitled',
                        author: row.author || '',
                        copyright: row.copyright || '',
                        administrator: row.administrator || '',
                        rtfContent: wordRow.words
                    });
                }
            } catch (wordError) {
                console.warn(`Failed to fetch words for song ${row.rowid}:`, wordError.message);
            }
        }
        songs.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });

        return songs;
    } catch (error) {
        console.error('Error reading songs from database:', error);
        throw new Error('Failed to read songs: ' + error.message);
    } finally {
        try {
            if (songsDb) songsDb.close();
        } catch (e) {
            console.error('Error closing Songs.db:', e);
        }
        try {
            if (wordsDb) wordsDb.close();
        } catch (e) {
            console.error('Error closing SongWords.db:', e);
        }
    }
}

/**
 * Converts RTF content to plain text
 * @param {string} rtfContent - RTF formatted content
 * @returns {string} Plain text
 */
function rtfToPlainText(rtfContent) {
    if (!rtfContent || typeof rtfContent !== 'string') {
        return '';
    }

    const BRACKET_PAIRS = [
        ['[', ']'],
        ['(', ')'],
        ['{', '}'],
        ['<', '>'],
    ];

    /**
     * Check if a line is a translation line based on bracket delimiters
     * @param {string} line
     * @returns {boolean}
     */
    function isTranslationLine(line) {
        if (!line || typeof line !== 'string') return false;
        const trimmed = line.trim();
        if (trimmed.length <= 2) return false;
        return BRACKET_PAIRS.some(([open, close]) =>
            trimmed.startsWith(open) && trimmed.endsWith(close)
        );
    }

    let text = rtfContent;

    text = text.replace(/\{\\rtf1[^}]*\}/g, '');
    text = text.replace(/\{\\fonttbl[^}]*\}/g, '');
    text = text.replace(/\{\\colortbl[^}]*\}/g, '');
    text = text.replace(/\{\\stylesheet[^}]*\}/g, '');
    text = text.replace(/\{\\info[^}]*\}/g, '');
    text = text.replace(/\{\\[^}]*\}/g, '');

    text = text.replace(/\\par\s*/g, '\n');
    text = text.replace(/\\line\s*/g, '\n');
    text = text.replace(/\\sdslidemarker/g, '\n');

    text = text.replace(/\\'92/g, "'");
    text = text.replace(/\\'91/g, "'");
    text = text.replace(/\\'93/g, '"');
    text = text.replace(/\\'94/g, '"');
    text = text.replace(/\\'96/g, '–');
    text = text.replace(/\\'97/g, '—');
    text = text.replace(/\\'85/g, '...');
    text = text.replace(/\\'a0/g, ' ');

    text = text.replace(/\\u8217\?/g, "'");
    text = text.replace(/\\u8216\?/g, "'");
    text = text.replace(/\\u8220\?/g, '"');
    text = text.replace(/\\u8221\?/g, '"');
    text = text.replace(/\\u8211\?/g, '–');
    text = text.replace(/\\u8212\?/g, '—');
    text = text.replace(/\\u8230\?/g, '...');
    text = text.replace(/\\u8242\?/g, "'");

    text = text.replace(/\\u(\d+)\?/g, (match, code) => {
        try {
            const charCode = parseInt(code);
            const actualCode = charCode < 0 ? 65536 + charCode : charCode;
            return String.fromCharCode(actualCode);
        } catch {
            return '';
        }
    });

    text = text.replace(/\\[a-z]+(-?\d+)?\s?/gi, ' ');
    text = text.replace(/[{}]/g, '');

    text = text.replace(/\t/g, ' ');
    text = text.replace(/ +/g, ' ');
    text = text.replace(/\n /g, '\n');
    text = text.replace(/ \n/g, '\n');

    let lines = text.split('\n').map(line => line.trim()).filter(line => line);

    const processedLines = [];
    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        const nextLine = lines[i + 1];

        processedLines.push(currentLine);

        if (i < lines.length - 1 && !isTranslationLine(nextLine)) {
            processedLines.push('');
        }
    }

    text = processedLines.join('\n').trimEnd();

    return text;
}

/**
 * Sanitizes filename for safe filesystem use
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
    if (!filename) return 'untitled';

    return filename
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
}

/**
 * Generates unique filename if file exists
 * @param {string} destPath - Destination folder path
 * @param {string} baseName - Base filename without extension
 * @param {string} handling - Duplicate handling strategy
 * @returns {Promise<{filename: string, skipped: boolean}>}
 */
async function getUniqueFilename(destPath, baseName, handling) {
    const filename = `${baseName}.txt`;
    const fullPath = path.join(destPath, filename);

    try {
        await fs.access(fullPath);

        if (handling === 'skip') {
            return { filename: null, skipped: true };
        }

        if (handling === 'overwrite') {
            return { filename, skipped: false };
        }

        let counter = 1;
        let newFilename;
        let newPath;

        do {
            newFilename = `${baseName} (${counter}).txt`;
            newPath = path.join(destPath, newFilename);
            counter++;

            try {
                await fs.access(newPath);
            } catch {
                return { filename: newFilename, skipped: false };
            }
        } while (counter < 1000);

        throw new Error('Too many duplicate files');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { filename, skipped: false };
        }
        throw error;
    }
}

/**
 * Imports a single song
 * @param {object} params
 * @returns {Promise<{success: boolean, skipped?: boolean, error?: string}>}
 */
export async function importSong({ song, destinationPath, duplicateHandling }) {
    try {
        await fs.mkdir(destinationPath, { recursive: true });

        const plainText = rtfToPlainText(song.rtfContent);

        if (!plainText.trim()) {
            return {
                success: false,
                error: 'No lyrics content found'
            };
        }

        const baseName = sanitizeFilename(song.title);
        const { filename, skipped } = await getUniqueFilename(
            destinationPath,
            baseName,
            duplicateHandling
        );

        if (skipped) {
            return { success: true, skipped: true };
        }

        let fileContent = '';

        if (song.title) {
            fileContent += `# Title: ${song.title}\n`;
        }
        if (song.author) {
            fileContent += `# Author: ${song.author}\n`;
        }
        if (song.copyright) {
            fileContent += `# Copyright: ${song.copyright}\n`;
        }
        if (song.administrator) {
            fileContent += `# Administrator: ${song.administrator}\n`;
        }

        fileContent += `# Imported from EasyWorship: ${new Date().toISOString().split('T')[0]}\n\n`;
        fileContent += plainText;

        const fullPath = path.join(destinationPath, filename);
        await fs.writeFile(fullPath, fileContent, 'utf8');

        return { success: true, skipped: false };
    } catch (error) {
        console.error('Error importing song:', error);
        return {
            success: false,
            error: error.message || 'Failed to import song'
        };
    }
}

/**
 * Opens folder in system file explorer
 * @param {string} folderPath
 */
export async function openFolder(folderPath) {
    const { shell } = await import('electron');
    await shell.openPath(folderPath);
}

/**
 * Shows dialog for browsing database path
 * @param {BrowserWindow} parentWindow
 * @returns {Promise<{path?: string, canceled: boolean}>}
 */
export async function browseForDatabasePath(parentWindow) {
    const result = await dialog.showOpenDialog(parentWindow, {
        properties: ['openDirectory'],
        title: 'Select EasyWorship Database Folder',
        buttonLabel: 'Select Folder'
    });

    if (result.canceled) {
        return { canceled: true };
    }

    return { path: result.filePaths[0], canceled: false };
}

/**
 * Shows dialog for browsing destination path
 * @param {BrowserWindow} parentWindow
 * @returns {Promise<{path?: string, canceled: boolean}>}
 */
export async function browseForDestinationPath(parentWindow) {
    const result = await dialog.showOpenDialog(parentWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Destination Folder for Imported Songs',
        buttonLabel: 'Select Folder'
    });

    if (result.canceled) {
        return { canceled: true };
    }

    return { path: result.filePaths[0], canceled: false };
}