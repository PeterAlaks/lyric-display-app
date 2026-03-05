import { dialog } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';

const SUPPORTED_EXTENSIONS = new Set(['.pptx']);

function decodeXmlEntities(value) {
    if (!value) {
        return '';
    }

    return String(value)
        .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function extractSlideLinesFromXml(xmlContent) {
    const paragraphRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
    const textRunRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    const lineBreakRegex = /<a:br\s*\/?\s*>/g;

    const lines = [];
    let paragraphMatch;

    while ((paragraphMatch = paragraphRegex.exec(xmlContent)) !== null) {
        const paragraphContent = paragraphMatch[1] || '';
        const normalized = paragraphContent.replace(lineBreakRegex, '\n');

        let runMatch;
        const runs = [];
        while ((runMatch = textRunRegex.exec(normalized)) !== null) {
            runs.push(decodeXmlEntities(runMatch[1] || ''));
        }

        if (!runs.length) {
            continue;
        }

        const joined = runs.join('').split('\n');
        for (const segment of joined) {
            const trimmed = segment.replace(/\s+/g, ' ').trim();
            if (trimmed) {
                lines.push(trimmed);
            }
        }
    }

    if (lines.length > 0) {
        return lines;
    }

    const fallbackRuns = [];
    let fallbackMatch;
    while ((fallbackMatch = textRunRegex.exec(xmlContent)) !== null) {
        const trimmed = decodeXmlEntities(fallbackMatch[1] || '').replace(/\s+/g, ' ').trim();
        if (trimmed) {
            fallbackRuns.push(trimmed);
        }
    }

    return fallbackRuns;
}

async function extractTextFromPptx(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(fileBuffer);

    const slidePaths = Object.keys(zip.files)
        .filter((entryPath) => /^ppt\/slides\/slide\d+\.xml$/i.test(entryPath))
        .sort((a, b) => {
            const aIndex = Number.parseInt((a.match(/slide(\d+)\.xml$/i) || [])[1] || '0', 10);
            const bIndex = Number.parseInt((b.match(/slide(\d+)\.xml$/i) || [])[1] || '0', 10);
            return aIndex - bIndex;
        });

    if (!slidePaths.length) {
        throw new Error('No readable slides found in .pptx file');
    }

    const slideBlocks = [];

    for (const slidePath of slidePaths) {
        const slideFile = zip.file(slidePath);
        if (!slideFile) {
            continue;
        }

        const xmlContent = await slideFile.async('string');
        const slideLines = extractSlideLinesFromXml(xmlContent);

        if (!slideLines.length) {
            continue;
        }

        slideBlocks.push(slideLines.join('\n'));
    }

    const text = slideBlocks.join('\n\n').trim();
    if (!text) {
        throw new Error('No readable slide text was found in .pptx file');
    }

    return text;
}

function sanitizeFilename(filename) {
    if (!filename) {
        return 'untitled';
    }

    return filename
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200) || 'untitled';
}

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
        while (counter < 1000) {
            const nextFilename = `${baseName} (${counter}).txt`;
            const nextPath = path.join(destPath, nextFilename);
            try {
                await fs.access(nextPath);
                counter += 1;
            } catch {
                return { filename: nextFilename, skipped: false };
            }
        }

        throw new Error('Too many duplicate files');
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return { filename, skipped: false };
        }
        throw error;
    }
}

async function extractPresentationText(filePath) {
    const extension = path.extname(filePath || '').toLowerCase();

    if (extension !== '.pptx') {
        throw new Error('Only .pptx files are supported');
    }

    return extractTextFromPptx(filePath);
}

export async function validatePresentationPath(inputPath) {
    try {
        if (!inputPath || typeof inputPath !== 'string') {
            return { success: false, error: 'Please provide a valid folder path' };
        }

        const normalizedPath = path.normalize(inputPath);
        const stats = await fs.stat(normalizedPath).catch(() => null);

        if (!stats || !stats.isDirectory()) {
            return { success: false, error: 'Selected path is not a valid folder' };
        }

        const entries = await fs.readdir(normalizedPath, { withFileTypes: true });
        const presentations = entries
            .filter((entry) => entry.isFile())
            .filter((entry) => SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
            .map((entry, index) => {
                const fullPath = path.join(normalizedPath, entry.name);
                const parsed = path.parse(entry.name);

                return {
                    id: `${entry.name}-${index}`,
                    title: parsed.name,
                    fileName: entry.name,
                    extension: '.pptx',
                    filePath: fullPath
                };
            })
            .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

        return {
            success: true,
            presentations,
            resolvedPath: normalizedPath
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to validate presentation folder'
        };
    }
}

export async function importPresentation({ presentation, destinationPath, duplicateHandling }) {
    try {
        if (!presentation?.filePath) {
            return { success: false, error: 'Invalid presentation data' };
        }

        await fs.mkdir(destinationPath, { recursive: true });

        const extractedText = await extractPresentationText(presentation.filePath);
        if (!extractedText || !extractedText.trim()) {
            return { success: false, error: 'No slide text found in presentation' };
        }

        const sourceName = presentation.title || path.parse(presentation.fileName || presentation.filePath).name;
        const baseName = sanitizeFilename(sourceName);
        const { filename, skipped } = await getUniqueFilename(destinationPath, baseName, duplicateHandling);

        if (skipped) {
            return { success: true, skipped: true };
        }

        const importedDate = new Date().toISOString().split('T')[0];
        const fileContent = [
            sourceName ? `# Title: ${sourceName}` : null,
            presentation.fileName ? `# Source File: ${presentation.fileName}` : null,
            `# Imported from PowerPoint (.pptx): ${importedDate}`,
            '',
            extractedText
        ]
            .filter((line) => line !== null)
            .join('\n');

        const outputPath = path.join(destinationPath, filename);
        await fs.writeFile(outputPath, fileContent, 'utf8');

        return { success: true, skipped: false };
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to import presentation'
        };
    }
}

export async function browseForPresentationPath(parentWindow) {
    const result = await dialog.showOpenDialog(parentWindow, {
        properties: ['openDirectory'],
        title: 'Select Folder with .pptx Files',
        buttonLabel: 'Select Folder'
    });

    if (result.canceled) {
        return { canceled: true };
    }

    return { path: result.filePaths[0], canceled: false };
}

export async function browseForDestinationPath(parentWindow) {
    const result = await dialog.showOpenDialog(parentWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Destination Folder for Imported Lyrics',
        buttonLabel: 'Select Folder'
    });

    if (result.canceled) {
        return { canceled: true };
    }

    return { path: result.filePaths[0], canceled: false };
}

export async function openFolder(folderPath) {
    const { shell } = await import('electron');
    await shell.openPath(folderPath);
}