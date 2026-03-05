import { dialog } from 'electron';
import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const SONGS_DB_FILENAME = 'songs.db';
const SONG_WORDS_DB_FILENAME = 'songwords.db';
const GENERIC_DATABASE_SUBPATH_CANDIDATES = [
    '',
    path.join('Databases', 'Data'),
    path.join('Default', 'Databases', 'Data'),
    path.join('Default_1', 'Databases', 'Data'),
    path.join('v6.1', 'Databases', 'Data')
];

function getDatabaseSubpathCandidates(expectedVersion) {
    if (expectedVersion === '2009') {
        return [
            '',
            path.join('Databases', 'Data'),
            path.join('Default', 'Databases', 'Data'),
            path.join('Default_1', 'Databases', 'Data')
        ];
    }

    if (expectedVersion === '6' || expectedVersion === '7') {
        return [
            '',
            path.join('Databases', 'Data'),
            path.join('v6.1', 'Databases', 'Data')
        ];
    }

    return GENERIC_DATABASE_SUBPATH_CANDIDATES;
}

function buildRootCandidates(inputPath) {
    const normalized = path.normalize(inputPath);
    const roots = [normalized];
    let current = normalized;

    // Walk up a few levels so users can select either Data, Default, or EasyWorship root folders.
    for (let i = 0; i < 4; i++) {
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        roots.push(parent);
        current = parent;
    }

    return roots;
}

function buildPathCandidates(inputPath, expectedVersion) {
    const subpathCandidates = getDatabaseSubpathCandidates(expectedVersion);
    const roots = buildRootCandidates(inputPath);
    const candidates = new Set();
    for (const root of roots) {
        for (const subPath of subpathCandidates) {
            if (!subPath) {
                candidates.add(root);
            } else {
                candidates.add(path.join(root, subPath));
            }
        }
    }

    return Array.from(candidates);
}

async function appendDynamic2009ProfileCandidates(candidates, inputPath) {
    const candidateSet = new Set(candidates);
    const roots = buildRootCandidates(inputPath);

    for (const root of roots) {
        const inspectedRoot = await inspectDirectoryFiles(root);
        if (!inspectedRoot) continue;

        for (const profileFolderName of inspectedRoot.values()) {
            if (!/^Default_\d+$/i.test(profileFolderName)) {
                continue;
            }
            candidateSet.add(path.join(root, profileFolderName, 'Databases', 'Data'));
        }
    }

    return Array.from(candidateSet);
}

async function inspectDirectoryFiles(dirPath) {
    try {
        const files = await fs.readdir(dirPath);
        const lowerCaseMap = new Map();

        for (const file of files) {
            const key = file.toLowerCase();
            if (!lowerCaseMap.has(key)) {
                lowerCaseMap.set(key, file);
            }
        }

        return lowerCaseMap;
    } catch {
        return null;
    }
}

async function resolveDatabasePath(inputPath, expectedVersion) {
    if (!inputPath || typeof inputPath !== 'string') {
        return { success: false, error: 'Path does not exist' };
    }

    let candidates = buildPathCandidates(inputPath, expectedVersion);
    if (expectedVersion === '2009') {
        candidates = await appendDynamic2009ProfileCandidates(candidates, inputPath);
    }
    let hasReadableDirectory = false;

    for (const candidatePath of candidates) {
        const inspected = await inspectDirectoryFiles(candidatePath);
        if (!inspected) {
            continue;
        }

        hasReadableDirectory = true;
        const songsDbFile = inspected.get(SONGS_DB_FILENAME);
        if (!songsDbFile) {
            continue;
        }

        const songWordsDbFile = inspected.get(SONG_WORDS_DB_FILENAME) || null;
        return {
            success: true,
            dbPath: candidatePath,
            songsDbFile,
            songWordsDbFile
        };
    }

    if (!hasReadableDirectory) {
        return { success: false, error: 'Path does not exist' };
    }

    return {
        success: false,
        error: 'Required database file not found. Looking for: Songs.db'
    };
}

function quoteIdentifier(name) {
    return `"${String(name || '').replace(/"/g, '""')}"`;
}

function listTableNames(db) {
    try {
        const rows = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
    `).all();
        return rows
            .map((row) => String(row.name || '').trim())
            .filter(Boolean);
    } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        if (message.includes('not a database')) {
            throw new Error('DATABASE_NOT_SQLITE');
        }
        throw error;
    }
}

function getTableColumns(db, tableName) {
    try {
        const rows = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
        return new Set(rows.map((row) => String(row.name || '').toLowerCase()));
    } catch {
        return new Set();
    }
}

function resolveTableName(tableNames, preferred = [], hint = '') {
    const normalized = tableNames.map((name) => ({
        name,
        lower: String(name || '').toLowerCase()
    }));

    for (const candidate of preferred) {
        const lowerCandidate = String(candidate || '').toLowerCase();
        const exact = normalized.find((entry) => entry.lower === lowerCandidate);
        if (exact) return exact.name;
    }

    if (hint) {
        const lowerHint = String(hint).toLowerCase();
        const hinted = normalized.find((entry) => entry.lower.includes(lowerHint));
        if (hinted) return hinted.name;
    }

    return null;
}

function resolveColumnName(columns, candidates = []) {
    for (const candidate of candidates) {
        const lowerCandidate = String(candidate || '').toLowerCase();
        if (columns.has(lowerCandidate)) {
            return lowerCandidate;
        }
    }
    return null;
}

function createWordTableExtractor(db, label) {
    if (!db) {
        return null;
    }

    const tableNames = listTableNames(db);
    const wordTableName = resolveTableName(
        tableNames,
        ['word', 'words', 'songword', 'songwords'],
        'word'
    );
    if (!wordTableName) {
        return null;
    }

    const columns = getTableColumns(db, wordTableName);
    const songIdColumn = resolveColumnName(columns, [
        'song_id',
        'songid',
        'song_rowid',
        'songrowid',
        'id_song',
        'song'
    ]);
    const lyricColumn = resolveColumnName(columns, [
        'words',
        'word',
        'lyrics',
        'text',
        'content'
    ]);

    if (!songIdColumn || !lyricColumn) {
        return null;
    }

    const statement = db.prepare(`
    SELECT ${quoteIdentifier(lyricColumn)} AS words
    FROM ${quoteIdentifier(wordTableName)}
    WHERE ${quoteIdentifier(songIdColumn)} = ?
  `);

    return {
        label,
        extract(songKey) {
            const row = statement.get(songKey);
            return typeof row?.words === 'string' ? row.words : '';
        }
    };
}

let cachedParadoxReader = null;
function getParadoxReader() {
    if (cachedParadoxReader) {
        return cachedParadoxReader;
    }

    const moduleExports = require('paradox-reader');
    cachedParadoxReader = moduleExports?.default || moduleExports;
    return cachedParadoxReader;
}

function resolveParadoxField(schemaFields, candidates = [], includesHint = '') {
    const normalized = schemaFields.map((name) => ({
        original: name,
        lower: String(name || '').toLowerCase()
    }));

    for (const candidate of candidates) {
        const lowerCandidate = String(candidate || '').toLowerCase();
        const exact = normalized.find((entry) => entry.lower === lowerCandidate);
        if (exact) return exact.original;
    }

    if (includesHint) {
        const lowerHint = String(includesHint).toLowerCase();
        const hinted = normalized.find((entry) => entry.lower.includes(lowerHint));
        if (hinted) return hinted.original;
    }

    return null;
}

function normalizeParadoxValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return String(value);
}

function groupSongKeyRows(songKeyRows) {
    const grouped = new Map();

    for (const row of songKeyRows) {
        const title = normalizeParadoxValue(row.title).trim();
        const author = normalizeParadoxValue(row.author).trim();
        const compositeKey = `${title.toLowerCase()}__${author.toLowerCase()}`;
        const verseNumber = Number(row.verseNumber);
        const verseValue = normalizeParadoxValue(row.verse).trim();

        if (!verseValue) continue;

        if (!grouped.has(compositeKey)) {
            grouped.set(compositeKey, []);
        }
        grouped.get(compositeKey).push({
            verseNumber: Number.isFinite(verseNumber) ? verseNumber : Number.MAX_SAFE_INTEGER,
            verse: verseValue
        });
    }

    const lyricsByKey = new Map();
    for (const [key, verses] of grouped.entries()) {
        verses.sort((a, b) => a.verseNumber - b.verseNumber);
        lyricsByKey.set(key, verses.map((item) => item.verse).join('\n\n'));
    }

    return lyricsByKey;
}

function toSongRecord(song, fallbackId) {
    const title = normalizeParadoxValue(song.title).trim() || 'Untitled';
    return {
        id: normalizeParadoxValue(song.id).trim() || String(fallbackId),
        rowid: fallbackId,
        title,
        author: normalizeParadoxValue(song.author).trim(),
        copyright: normalizeParadoxValue(song.copyright).trim(),
        administrator: normalizeParadoxValue(song.administrator).trim(),
        rtfContent: normalizeParadoxValue(song.rtfContent)
    };
}

/**
 * Validates if the given path contains required EasyWorship database files
 * @param {string} dbPath - Path to database folder
 * @param {{version?: string}} options
 * @returns {Promise<{success: boolean, songs?: Array, error?: string}>}
 */
export async function validateDatabasePath(dbPath, options = {}) {
    try {
        const expectedVersion = typeof options?.version === 'string'
            ? options.version.trim()
            : '';
        const resolved = await resolveDatabasePath(dbPath, expectedVersion);
        if (!resolved.success) {
            return { success: false, error: resolved.error };
        }

        const songs = await readSongsFromDatabase(resolved, expectedVersion);

        return {
            success: true,
            songs,
            resolvedPath: resolved.dbPath
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
 * @param {object} resolvedPath
 * @param {string} expectedVersion
 * @returns {Promise<Array>}
 */
async function readSongsFromDatabase(resolvedPath, expectedVersion) {
    try {
        return readSongsFromSqliteDatabase(resolvedPath);
    } catch (error) {
        const message = String(error?.message || '');
        const lowerMessage = message.toLowerCase();

        const shouldTryParadox =
            expectedVersion === '2009' ||
            message === 'DATABASE_NOT_SQLITE' ||
            error?.code === 'SQLITE_MISSING_SONG_TABLE' ||
            error?.code === 'SQLITE_NO_LYRIC_SOURCE' ||
            lowerMessage.includes('not a database');

        if (shouldTryParadox) {
            try {
                return await readSongsFromParadoxDatabase(resolvedPath);
            } catch (paradoxError) {
                const paradoxMessage = String(paradoxError?.message || '');
                if (expectedVersion === '2009') {
                    throw new Error(`Failed to read songs: ${paradoxMessage}`);
                }
            }
        }

        if (message === 'DATABASE_NOT_SQLITE' || lowerMessage.includes('not a database')) {
            throw new Error('Failed to read songs: database format is not supported by this importer');
        }

        throw new Error('Failed to read songs: ' + message);
    }
}

function readSongsFromSqliteDatabase(resolvedPath) {
    const songsDbPath = path.join(resolvedPath.dbPath, resolvedPath.songsDbFile);
    const wordsDbPath = resolvedPath.songWordsDbFile
        ? path.join(resolvedPath.dbPath, resolvedPath.songWordsDbFile)
        : null;

    let songsDb = null;
    let wordsDb = null;

    try {
        songsDb = new Database(songsDbPath, { readonly: true, fileMustExist: true });
        if (wordsDbPath) {
            wordsDb = new Database(wordsDbPath, { readonly: true, fileMustExist: true });
        }

        const tableNames = listTableNames(songsDb);
        const songTableName = resolveTableName(tableNames, ['song', 'songs'], 'song');
        if (!songTableName) {
            const error = new Error('Unsupported database schema: missing table "song" or "songs"');
            error.code = 'SQLITE_MISSING_SONG_TABLE';
            throw error;
        }

        const songTableColumns = getTableColumns(songsDb, songTableName);
        const songUidColumn = resolveColumnName(songTableColumns, ['song_uid', 'songuid', 'song_id', 'songid', 'uid', 'id']);
        const songKeyColumn = resolveColumnName(songTableColumns, ['song_id', 'songid', 'id']);
        const titleColumn = resolveColumnName(songTableColumns, ['title', 'song_title', 'songtitle', 'name']);
        const authorColumn = resolveColumnName(songTableColumns, ['author', 'writer', 'artist']);
        const copyrightColumn = resolveColumnName(songTableColumns, ['copyright']);
        const administratorColumn = resolveColumnName(songTableColumns, ['administrator']);
        const inlineLyricsColumn = resolveColumnName(songTableColumns, ['words', 'lyrics', 'text', 'content']);

        const selectableColumns = ['rowid'];
        if (songUidColumn) selectableColumns.push(`${quoteIdentifier(songUidColumn)} AS song_uid`);
        if (songKeyColumn) selectableColumns.push(`${quoteIdentifier(songKeyColumn)} AS song_key`);
        if (titleColumn) selectableColumns.push(`${quoteIdentifier(titleColumn)} AS title`);
        if (authorColumn) selectableColumns.push(`${quoteIdentifier(authorColumn)} AS author`);
        if (copyrightColumn) selectableColumns.push(`${quoteIdentifier(copyrightColumn)} AS copyright`);
        if (administratorColumn) selectableColumns.push(`${quoteIdentifier(administratorColumn)} AS administrator`);
        if (inlineLyricsColumn) selectableColumns.push(`${quoteIdentifier(inlineLyricsColumn)} AS inline_lyrics`);

        const songRows = songsDb.prepare(`
      SELECT ${selectableColumns.join(', ')}
      FROM ${quoteIdentifier(songTableName)}
    `).all();

        const lyricExtractors = [];
        let externalWordsExtractor = null;
        try {
            externalWordsExtractor = createWordTableExtractor(wordsDb, 'SongWords');
        } catch (extractorError) {
            console.warn('Skipping SongWords.db extractor:', extractorError.message);
        }
        const localWordsExtractor = createWordTableExtractor(songsDb, 'Songs');

        if (externalWordsExtractor) lyricExtractors.push(externalWordsExtractor);
        if (localWordsExtractor) lyricExtractors.push(localWordsExtractor);
        if (inlineLyricsColumn) {
            lyricExtractors.push({
                label: `song.${inlineLyricsColumn}`,
                extract(_key, row) {
                    return typeof row?.inline_lyrics === 'string' ? row.inline_lyrics : '';
                }
            });
        }

        if (songRows.length > 0 && lyricExtractors.length === 0) {
            const error = new Error('Unsupported database schema: no lyric source found');
            error.code = 'SQLITE_NO_LYRIC_SOURCE';
            throw error;
        }

        const songs = [];

        for (const row of songRows) {
            let rtfContent = '';
            const lookupKeys = [];
            if (row.song_key !== undefined && row.song_key !== null && String(row.song_key).trim() !== '') {
                lookupKeys.push(row.song_key);
            }
            lookupKeys.push(row.rowid);

            for (const extractor of lyricExtractors) {
                for (const key of lookupKeys) {
                    try {
                        const candidateLyrics = extractor.extract(key, row);
                        if (candidateLyrics && String(candidateLyrics).trim()) {
                            rtfContent = String(candidateLyrics);
                            break;
                        }
                    } catch (extractError) {
                        console.warn(`Failed lyric extraction from ${extractor.label} for song ${row.rowid}:`, extractError.message);
                    }
                }
                if (rtfContent) break;
            }

            if (!rtfContent) {
                continue;
            }

            songs.push({
                id: row.song_uid ? String(row.song_uid) : String(row.rowid),
                rowid: row.rowid,
                title: row.title || 'Untitled',
                author: row.author || '',
                copyright: row.copyright || '',
                administrator: row.administrator || '',
                rtfContent
            });
        }

        songs.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });

        return songs;
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

async function tryReadParadoxSongKeys(dbPath) {
    const filesInDir = await fs.readdir(dbPath);
    const songKeysFilename = filesInDir.find((file) => file.toLowerCase() === 'songkeys.db');
    if (!songKeysFilename) {
        return null;
    }

    const paradox = getParadoxReader();
    const songKeysPath = path.join(dbPath, songKeysFilename);
    let parsed;
    try {
        parsed = paradox.scan(songKeysPath);
    } catch {
        return null;
    }
    const schemaFields = (parsed?.schema || []).map((field) => field?.name).filter(Boolean);
    if (schemaFields.length === 0) {
        return null;
    }

    const titleField = resolveParadoxField(schemaFields, ['Title', 'Song Title'], 'title');
    const authorField = resolveParadoxField(schemaFields, ['Author'], 'author');
    const verseField = resolveParadoxField(schemaFields, ['Verse', 'Words', 'Lyrics', 'Text'], 'verse');
    const verseNumberField = resolveParadoxField(schemaFields, ['Verse Number', 'VerseNumber', 'VerseNo', 'Number'], 'verse');

    if (!titleField || !verseField) {
        return null;
    }

    const rows = (parsed?.records || []).map((row) => ({
        title: row?.[titleField],
        author: authorField ? row?.[authorField] : '',
        verse: row?.[verseField],
        verseNumber: verseNumberField ? row?.[verseNumberField] : Number.MAX_SAFE_INTEGER
    }));
    return groupSongKeyRows(rows);
}

async function readSongsFromParadoxDatabase(resolvedPath) {
    const songsDbPath = path.join(resolvedPath.dbPath, resolvedPath.songsDbFile);
    const paradox = getParadoxReader();

    let parsed;
    try {
        parsed = paradox.scan(songsDbPath);
    } catch (error) {
        const message = String(error?.message || '');
        if (message.toLowerCase().includes('invalid field count')) {
            throw new Error('Selected EasyWorship 2009, but this database does not appear to be an EasyWorship 2009 Paradox table.');
        }
        throw new Error(message || 'Failed to parse EasyWorship 2009 database');
    }
    const records = parsed?.records || [];
    const schemaFields = (parsed?.schema || []).map((field) => field?.name).filter(Boolean);

    if (schemaFields.length === 0) {
        throw new Error('Unsupported EasyWorship 2009 database schema');
    }

    const titleField = resolveParadoxField(schemaFields, ['Title', 'Song Title', 'Name'], 'title');
    const authorField = resolveParadoxField(schemaFields, ['Author', 'Writer', 'Artist'], 'author');
    const idField = resolveParadoxField(schemaFields, ['RecID', 'Song_UID', 'Song ID', 'ID'], 'id');
    const copyrightField = resolveParadoxField(schemaFields, ['Copyright'], 'copyright');
    const administratorField = resolveParadoxField(schemaFields, ['Administrator'], 'administrator');
    const lyricsField = resolveParadoxField(schemaFields, ['Words', 'Lyrics', 'Text', 'Content'], 'words');

    let songKeysLyrics = null;
    if (!lyricsField) {
        songKeysLyrics = await tryReadParadoxSongKeys(resolvedPath.dbPath);
    }

    if (!lyricsField && (!songKeysLyrics || songKeysLyrics.size === 0)) {
        throw new Error('EasyWorship 2009 database found, but no readable lyric field was detected');
    }

    const songs = [];
    records.forEach((row, index) => {
        const title = titleField ? normalizeParadoxValue(row?.[titleField]).trim() : '';
        const author = authorField ? normalizeParadoxValue(row?.[authorField]).trim() : '';

        let rtfContent = lyricsField
            ? normalizeParadoxValue(row?.[lyricsField])
            : '';

        if (!rtfContent && songKeysLyrics && songKeysLyrics.size > 0) {
            const key = `${title.toLowerCase()}__${author.toLowerCase()}`;
            rtfContent = songKeysLyrics.get(key) || '';
        }

        if (!rtfContent || !String(rtfContent).trim()) {
            return;
        }

        const id = idField ? normalizeParadoxValue(row?.[idField]).trim() : '';
        songs.push(toSongRecord({
            id,
            title,
            author,
            copyright: copyrightField ? row?.[copyrightField] : '',
            administrator: administratorField ? row?.[administratorField] : '',
            rtfContent
        }, index + 1));
    });

    songs.sort((a, b) => {
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        return titleA.localeCompare(titleB);
    });

    return songs;
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

    function decodeHexEscape(hex) {
        const code = Number.parseInt(hex, 16);
        if (!Number.isFinite(code)) return '';
        const map = {
            0x85: '...',
            0x91: "'",
            0x92: "'",
            0x93: '"',
            0x94: '"',
            0x96: '-',
            0x97: '-',
            0xa0: ' ',
        };
        if (map[code]) return map[code];
        try {
            return Buffer.from([code]).toString('latin1');
        } catch {
            return '';
        }
    }

    function detectGroupDestination(input, braceIndex) {
        let j = braceIndex + 1;
        while (j < input.length && /\s/.test(input[j])) j++;

        let hasStarDestination = false;
        if (input[j] === '\\' && input[j + 1] === '*') {
            hasStarDestination = true;
            j += 2;
            while (j < input.length && /\s/.test(input[j])) j++;
        }

        let word = '';
        if (input[j] === '\\') {
            j++;
            while (j < input.length && /[a-zA-Z]/.test(input[j])) {
                word += input[j];
                j++;
            }
        }

        return { hasStarDestination, word: word.toLowerCase() };
    }

    function parseRtfText(input) {
        if (!input.includes('\\') && !input.includes('{')) {
            return input;
        }

        const stripDestinations = new Set([
            'fonttbl', 'colortbl', 'stylesheet', 'info',
            'pict', 'object', 'header', 'footer', 'footerf',
            'pntext', 'pnseclvl', 'listtable', 'listoverridetable'
        ]);

        let out = '';
        const skipStack = [false];
        let i = 0;

        while (i < input.length) {
            const ch = input[i];
            const isSkipping = skipStack[skipStack.length - 1];

            if (ch === '{') {
                const { hasStarDestination, word } = detectGroupDestination(input, i);
                const shouldStrip = hasStarDestination
                    || stripDestinations.has(word)
                    || word.startsWith('pnseclvl');
                skipStack.push(isSkipping || shouldStrip);
                i++;
                continue;
            }

            if (ch === '}') {
                if (skipStack.length > 1) skipStack.pop();
                i++;
                continue;
            }

            if (isSkipping) {
                i++;
                continue;
            }

            if (ch !== '\\') {
                out += ch;
                i++;
                continue;
            }

            const next = input[i + 1];
            if (!next) {
                i++;
                continue;
            }

            if (next === '\\' || next === '{' || next === '}') {
                out += next;
                i += 2;
                continue;
            }

            if (next === "'") {
                const hex = input.slice(i + 2, i + 4);
                out += decodeHexEscape(hex);
                i += 4;
                continue;
            }

            if (next === '~') {
                out += ' ';
                i += 2;
                continue;
            }

            if (next === '-') {
                i += 2;
                continue;
            }

            let j = i + 1;
            let word = '';
            while (j < input.length && /[a-zA-Z]/.test(input[j])) {
                word += input[j];
                j++;
            }

            let sign = 1;
            if (input[j] === '-') {
                sign = -1;
                j++;
            }
            let digits = '';
            while (j < input.length && /\d/.test(input[j])) {
                digits += input[j];
                j++;
            }

            if (input[j] === ' ') {
                j++;
            }

            const lowerWord = word.toLowerCase();
            if (lowerWord === 'par' || lowerWord === 'line') {
                out += '\n';
            } else if (lowerWord === 'tab') {
                out += '\t';
            } else if (lowerWord === 'u' && digits) {
                const charCode = sign * Number.parseInt(digits, 10);
                const actualCode = charCode < 0 ? 65536 + charCode : charCode;
                out += String.fromCharCode(actualCode);
                if (input[j] === '?') {
                    j++;
                }
            } else if (lowerWord === 'emdash' || lowerWord === 'endash') {
                out += '-';
            } else if (lowerWord === 'lquote' || lowerWord === 'rquote') {
                out += "'";
            } else if (lowerWord === 'ldblquote' || lowerWord === 'rdblquote') {
                out += '"';
            } else if (lowerWord === 'bullet') {
                out += '*';
            }

            i = j;
        }

        return out;
    }

    let text = parseRtfText(rtfContent);
    text = text.replace(/\0/g, '');
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    text = text.replace(/\t/g, ' ');
    text = text.replace(/[ ]{2,}/g, ' ');
    text = text.replace(/\n /g, '\n');
    text = text.replace(/ \n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
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

    if (!text.trim()) {
        return String(rtfContent).replace(/\0/g, '').trim();
    }

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
