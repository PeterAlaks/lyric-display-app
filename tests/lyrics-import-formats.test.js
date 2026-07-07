import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import {
  getLyricsAcceptAttribute,
  getLyricFormatLabel,
  getLyricImportFormatForName,
  isSupportedLyricsImportFile,
  stripLyricImportExtension,
} from '../shared/lyricImportRegistry.js';
import {
  extractRtfText,
  normalizeMarkdownLyrics,
  parseLyricImportContent,
} from '../shared/documentTextExtraction.js';
import { validateSetlistData } from '../main/setlistValidation.js';
import { parseLyricsFileAsync } from '../src/utils/asyncLyricsParser.js';

async function createDocxBuffer(lines = []) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${lines.map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join('\n')}
  </w:body>
</w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('lyric import format registry recognizes supported document formats', () => {
  assert.equal(isSupportedLyricsImportFile('song.docx'), true);
  assert.equal(isSupportedLyricsImportFile('song.rtf'), true);
  assert.equal(isSupportedLyricsImportFile('song.markdown'), true);
  assert.equal(isSupportedLyricsImportFile('song.doc'), false);
  assert.equal(isSupportedLyricsImportFile('song.pdf'), false);

  assert.equal(getLyricImportFormatForName('song.md')?.fileType, 'md');
  assert.equal(getLyricFormatLabel('docx'), 'Word Document');
  assert.equal(stripLyricImportExtension('Amazing Grace.markdown'), 'Amazing Grace');
  assert.equal(getLyricsAcceptAttribute().includes('.docx'), true);
});

test('markdown lyrics normalize headings and inline formatting to plain lyric text', () => {
  const normalized = normalizeMarkdownLyrics([
    '# Verse 1',
    '- **Amazing** grace',
    '> How _sweet_ the sound',
    '[Chorus link](https://example.com)',
  ].join('\n'));

  assert.equal(normalized, '[Verse 1]\nAmazing grace\nHow sweet the sound\nChorus link');
});

test('rtf lyrics extract common paragraph, unicode, and formatting controls', () => {
  const text = extractRtfText('{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\b Amazing \\b0 grace\\par How sweet\\line the sound\\par Unicode \\u8211? dash}');

  assert.equal(text, 'Amazing grace\nHow sweet\nthe sound\nUnicode – dash');
});

test('document import parser routes markdown and rtf through plain text lyrics parser', async () => {
  const markdown = await parseLyricImportContent({
    fileType: 'md',
    rawText: '# Verse\nAmazing grace',
    parsingOptions: { enableSplitting: false, groupingConfig: { enableAutoLineGrouping: false } },
  });
  const rtf = await parseLyricImportContent({
    fileType: 'rtf',
    rawText: '{\\rtf1\\ansi Amazing grace\\par How sweet the sound}',
    parsingOptions: { enableSplitting: false, groupingConfig: { enableAutoLineGrouping: false } },
  });

  assert.deepEqual(markdown.processedLines, ['[Verse]', 'Amazing grace']);
  assert.deepEqual(rtf.processedLines, ['Amazing grace', 'How sweet the sound']);
});

test('docx import extracts text and feeds the existing lyrics parser', async () => {
  const buffer = await createDocxBuffer(['Amazing grace', 'How sweet the sound']);
  const parsed = await parseLyricImportContent({
    fileType: 'docx',
    rawBytes: buffer,
    parsingOptions: { enableSplitting: false, groupingConfig: { enableAutoLineGrouping: false } },
  });

  assert.deepEqual(parsed.processedLines, ['Amazing grace', 'How sweet the sound']);
});

test('async lyrics parser accepts markdown files without Electron IPC', async () => {
  const file = new File(['# Verse\nAmazing grace'], 'song.md', { type: 'text/markdown' });
  const parsed = await parseLyricsFileAsync(file, {
    fileType: 'md',
    groupingConfig: { enableAutoLineGrouping: false },
  });

  assert.deepEqual(parsed.processedLines, ['[Verse]', 'Amazing grace']);
});

test('setlist validation accepts imported document lyric file types', () => {
  const validation = validateSetlistData({
    version: '1.0',
    items: [
      {
        displayName: 'Service Song',
        originalName: 'Service Song.docx',
        fileType: 'docx',
        content: 'Amazing grace',
      },
      {
        displayName: 'Response',
        originalName: 'Response.rtf',
        fileType: 'rtf',
        content: 'How sweet the sound',
      },
    ],
  });

  assert.equal(validation.valid, true);
});
