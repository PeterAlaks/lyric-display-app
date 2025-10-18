import { fetchWithTimeout } from '../fetchWithTimeout.js';

const BASE_URL = 'http://api.chartlyrics.com/apiv1.asmx';

export const definition = {
    id: 'chartlyrics',
    displayName: 'ChartLyrics',
    description: 'Free lyrics API with good coverage of popular songs. No API key required.',
    requiresKey: false,
    homepage: 'http://www.chartlyrics.com',
    supportedFeatures: {
        suggestions: true,
        search: true,
        lyrics: true,
    },
};

const parseXmlField = (xml, tagName) => {
    const regex = new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
};

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
    const parts = trimmed.split(/\s+/);

    let song = trimmed;
    let artist = '';

    if (parts.length >= 2) {
        const midpoint = Math.floor(parts.length / 2);
        song = parts.slice(0, midpoint).join(' ');
        artist = parts.slice(midpoint).join(' ');
    }

    const url = `${BASE_URL}/SearchLyric?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(song)}`;

    try {
        const fetchFn = fetchImpl === fetch ? fetchWithTimeout : fetchImpl;
        const resp = await fetchFn(url, {
            signal,
            headers: {
                'User-Agent': 'LyricDisplay/4.4.5 (https://github.com/PeterAlaks/lyric-display-app)',
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
            'User-Agent': 'LyricDisplay/4.4.5 (https://github.com/PeterAlaks/lyric-display-app)',
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