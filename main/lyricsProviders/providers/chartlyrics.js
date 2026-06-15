import { fetchWithTimeout } from '../fetchWithTimeout.js';
import { LYRICS_PROVIDER_USER_AGENT } from '../userAgent.js';
import { analyzeQuery } from '../searchAlgorithm.js';

const BASE_URL = 'http://api.chartlyrics.com/apiv1.asmx';

export const definition = {
    id: 'chartlyrics',
    displayName: 'ChartLyrics',
    description: 'Free lyrics API with good coverage of popular songs. No API key required.',
    requiresKey: false,
    homepage: 'http://www.chartlyrics.com',
    metadata: {
        legacyHttp: true,
        lowTrust: true,
        trustScore: 0.5,
        reason: 'Legacy HTTP XML API with inconsistent availability; treated as a fallback source.',
    },
    supportedFeatures: {
        suggestions: true,
        search: true,
        lyrics: true,
    },
};

const parseXmlField = (xml, tagName) => {
    const regex = new RegExp(`<${tagName}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\/${tagName}>`, 'i');
    const match = xml.match(regex);
    const value = match ? (match[1] ?? match[2] ?? '').trim() : null;
    return value ? decodeXmlEntities(value) : null;
};

const decodeXmlEntities = (value) => value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

const parseSearchResults = (xmlText) => {
    const results = [];
    const resultRegex = /<SearchLyricResult>([\s\S]*?)<\/SearchLyricResult>/gi;
    let match;

    while ((match = resultRegex.exec(xmlText)) !== null) {
        const resultXml = match[1];

        const lyricId = parseXmlField(resultXml, 'LyricId');
        const checksum = parseXmlField(resultXml, 'LyricChecksum');
        const song = parseXmlField(resultXml, 'Song');
        const artist = parseXmlField(resultXml, 'Artist');
        const songUrl = parseXmlField(resultXml, 'SongUrl');

        if (lyricId && checksum && song && artist) {
            results.push({
                lyricId,
                checksum,
                song,
                artist,
                songUrl,
            });
        }
    }

    return results;
};

const normalizeTrack = (item) => {
    const artist = item?.artist || 'Unknown Artist';
    const title = item?.song || 'Untitled';

    return {
        id: `${definition.id}:${item?.lyricId ?? `${artist}:${title}`}`,
        provider: definition.id,
        title,
        artist,
        snippet: '',
        payload: {
            artist,
            title,
            lyricId: item?.lyricId || null,
            checksum: item?.checksum || null,
        },
        metadata: {
            songUrl: item?.songUrl || null,
        },
    };
};

export async function search(query, { limit = 10, signal, fetchImpl = fetch } = {}) {
    if (!query || !query.trim()) {
        return { results: [], errors: [] };
    }

    const trimmed = query.trim();
    let song = trimmed;
    let artist = '';
    const analysis = analyzeQuery(trimmed);
    if (analysis.inferredTitle) {
        song = analysis.inferredTitle;
    }
    if (analysis.inferredArtist && analysis.confidence >= 0.65) {
        artist = analysis.inferredArtist;
    }

    const url = `${BASE_URL}/SearchLyric?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(song)}`;

    try {
        const fetchFn = fetchImpl === fetch ? fetchWithTimeout : fetchImpl;
        const resp = await fetchFn(url, {
            signal,
            headers: {
                'User-Agent': LYRICS_PROVIDER_USER_AGENT,
            },
        });

        if (!resp.ok) {
            const message = `ChartLyrics search failed (${resp.status})`;
            return { results: [], errors: [message] };
        }

        const xmlText = await resp.text();
        const items = parseSearchResults(xmlText);
        const normalized = items.slice(0, limit).map(normalizeTrack);

        return { results: normalized, errors: [] };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { results: [], errors: [] };
        }
        return { results: [], errors: [error.message || 'ChartLyrics search failed'] };
    }
}

export async function getLyrics({ payload }, { signal, fetchImpl = fetch } = {}) {
    if (!payload?.lyricId || !payload?.checksum) {
        throw new Error('ChartLyrics requires lyricId and checksum from search results');
    }

    const url = `${BASE_URL}/GetLyric?lyricId=${encodeURIComponent(payload.lyricId)}&lyricCheckSum=${encodeURIComponent(payload.checksum)}`;

    const fetchFn = fetchImpl === fetch ? fetchWithTimeout : fetchImpl;
    const resp = await fetchFn(url, {
        signal,
        headers: {
            'User-Agent': LYRICS_PROVIDER_USER_AGENT,
        },
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`ChartLyrics lyrics request failed: ${resp.status} ${body}`);
    }

    const xmlText = await resp.text();

    const lyric = parseXmlField(xmlText, 'Lyric');
    const song = parseXmlField(xmlText, 'LyricSong');
    const artist = parseXmlField(xmlText, 'LyricArtist');
    const lyricUrl = parseXmlField(xmlText, 'LyricUrl');

    if (!lyric || !lyric.trim()) {
        throw new Error('ChartLyrics returned no lyric content.');
    }

    return {
        provider: definition.id,
        title: song || payload.title,
        artist: artist || payload.artist,
        content: lyric.trim(),
        sourceUrl: lyricUrl || `http://www.chartlyrics.com`,
        credits: null,
    };
}
