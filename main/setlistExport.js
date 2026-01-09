import PDFDocument from 'pdfkit';
import { createWriteStream, readFileSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { appRoot } from './paths.js';

function countLyricLines(content) {
  if (!content || typeof content !== 'string') return 0;

  const lines = content.split('\n');
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('[')) {
      count++;
    }
  }

  return count;
}

function cleanLyrics(content) {
  if (!content || typeof content !== 'string') return '';

  const lines = content.split('\n');
  const cleaned = [];

  for (const line of lines) {
    const withoutTimestamp = line.replace(/\[\d+:\d+(?:\.\d+)?\]\s*/g, '');
    cleaned.push(withoutTimestamp);
  }

  return cleaned.join('\n');
}

export async function exportSetlistToPDF(filePath, setlistData, options = {}) {
  const { title = 'Setlist', includeLyrics = false } = options;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(24)
        .font('Helvetica-Bold')
        .text(title, { align: 'center' });

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Created on ${dateStr} at ${timeStr}`, { align: 'center' });

      doc.fillColor('#000000');
      doc.moveDown(1);

      const headerY = doc.y;
      doc.strokeColor('#E5E7EB')
        .lineWidth(0.5)
        .moveTo(50, headerY)
        .lineTo(doc.page.width - 50, headerY)
        .stroke();

      doc.moveDown(1.5);

      const songs = setlistData.items || [];

      if (!includeLyrics) {
        doc.fontSize(12).font('Helvetica');

        songs.forEach((song, index) => {
          const lineCount = countLyricLines(song.content);
          const songTitle = song.displayName || song.originalName || `Song ${index + 1}`;

          doc.fontSize(14)
            .font('Helvetica-Bold')
            .text(`${index + 1}. ${songTitle}`, { continued: false });

          doc.fontSize(11)
            .font('Helvetica')
            .fillColor('#666666')
            .text(`   (${lineCount} lyric lines)`, { continued: false });

          doc.fillColor('#000000');
          doc.moveDown(0.5);
        });
      } else {
        songs.forEach((song, index) => {
          if (index > 0) {
            doc.moveDown(1);
            const y = doc.y;
            doc.strokeColor('#CCCCCC')
              .lineWidth(1)
              .dash(5, { space: 3 })
              .moveTo(50, y)
              .lineTo(doc.page.width - 50, y)
              .stroke();
            doc.undash();
            doc.moveDown(1);
          }

          const songTitle = song.displayName || song.originalName || `Song ${index + 1}`;

          doc.fontSize(16)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(songTitle, { continued: false });

          doc.moveDown(0.5);

          const cleanedLyrics = cleanLyrics(song.content || '');
          doc.fontSize(11)
            .font('Helvetica')
            .fillColor('#333333')
            .text(cleanedLyrics || '(No lyrics)', { continued: false });

          doc.fillColor('#000000');
          doc.moveDown(1);
        });
      }

      try {
        const logoPath = path.join(appRoot, 'public', 'logos', 'LyricDisplay logo.png');
        const logoBuffer = readFileSync(logoPath);

        const pageHeight = doc.page.height;
        const footerY = pageHeight - 80;

        doc.strokeColor('#E5E7EB')
          .lineWidth(0.5)
          .moveTo(50, footerY - 10)
          .lineTo(doc.page.width - 50, footerY - 10)
          .stroke();

        const logoWidth = 120;
        const logoHeight = 30;
        doc.image(logoBuffer, 50, footerY, {
          width: logoWidth,
          align: 'left'
        });

        doc.link(50, footerY, logoWidth, logoHeight, 'https://lyricdisplay.app');

        const fontSize = 9;
        const textY = footerY + (logoHeight / 2) - (fontSize / 2);
        doc.fontSize(fontSize)
          .font('Helvetica')
          .fillColor('#6B7280')
          .text('Prepared by the LyricDisplay App', 180, textY, {
            align: 'left',
            link: 'https://lyricdisplay.app'
          });

      } catch (error) {
        console.error('Failed to add logo to PDF footer:', error);

      }

      doc.end();

      stream.on('finish', () => {
        resolve({ success: true, filePath });
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}

export async function exportSetlistToTXT(filePath, setlistData, options = {}) {
  const { title = 'Setlist', includeLyrics = false } = options;

  try {
    const fs = await import('fs/promises');
    let content = '';

    content += `${title}\n`;
    content += '='.repeat(title.length) + '\n';

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    content += `Created on ${dateStr} at ${timeStr}\n`;
    content += '-'.repeat(60) + '\n\n';

    const songs = setlistData.items || [];

    if (!includeLyrics) {

      songs.forEach((song, index) => {
        const lineCount = countLyricLines(song.content);
        const songTitle = song.displayName || song.originalName || `Song ${index + 1}`;
        content += `${index + 1}. ${songTitle} (${lineCount} lyric lines)\n`;
      });
    } else {
      songs.forEach((song, index) => {
        if (index > 0) {
          content += '\n' + '-'.repeat(60) + '\n\n';
        }

        const songTitle = song.displayName || song.originalName || `Song ${index + 1}`;
        content += `${songTitle}\n\n`;

        const cleanedLyrics = cleanLyrics(song.content || '');
        content += cleanedLyrics || '(No lyrics)';
        content += '\n\n';
      });
    }

    content += '\n' + '-'.repeat(60) + '\n';
    content += 'Prepared by the LyricDisplay App | Download at: https://lyricdisplay.app\n';

    await fs.writeFile(filePath, content, 'utf8');

    return { success: true, filePath };
  } catch (error) {
    throw error;
  }
}