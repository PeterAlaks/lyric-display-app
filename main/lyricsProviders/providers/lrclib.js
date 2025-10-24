import { fetchWithTimeout } from '../fetchWithTimeout.js';

const BASE_URL = 'https://lrclib.net/api';

export const definition = {
    id: 'lrclib',
    displayName: 'LRCLIB',
    description: 'Free synced lyrics database with nearly 3 million lyrics. No API key required.',
    requiresKey: false,
    homepage: 'https://lrclib.net',
    supportedFeatures: {
        suggestions: true,
        search: true,
        lyrics: true,
        syncedLyrics: true,
    },
};

const normalizeTrack = (item) => {
    const artist = item?.artistName || 'Unknown Artist';
    const title = item?.trackName || 'Untitled';
    const album = item?.albumName || '';
    const duration = item?.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : '';

    return {
        id: `${definition.id}:${item?.id ?? `${artist}:${title}`}`,
        provider: definition.id,
        title,
        artist,
        album,
        snippet: album ? `${album}${duration ? ` • ${duration}` : ''}` : duration,
        payload: {
            artist,
            title,
            album,
            duration: item?.duration || null,
            lrcId: item?.id || null,
        },
        metadata: {
            instrumental: item?.instrumental ?? false,
            duration: item?.duration ?? null,
        },
    };
};

export async function search(query, { limit = 10, signal, fetchImpl = fetch } = {}) {
    if (!query || !query.trim()) {
        return { results: [], errors: [] };
    }

    const trimmed = query.trim();

    const url = `${BASE_URL}/search?q=${encodeURIComponent(trimmed)}`;

    try {
        const fetchFn = fetchImpl === fetch ? fetchWithTimeout : fetchImpl;
        const resp = await fetchFn(url, {
            signal,
            headers: {
                'User-Agent': 'LyricDisplay/4.4.5 (https://github.com/PeterAlaks/lyric-display-app)',
            },
        });

        if (!resp.ok) {
            const message = `LRCLIB search failed (${resp.status})`;
            return { results: [], errors: [message] };
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? data.slice(0, limit) : [];
        const normalized = items.map(normalizeTrack);

        return { results: normalized, errors: [] };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { results: [], errors: [] };
        }
        return { results: [], errors: [error.message || 'LRCLIB search failed'] };
    }
}

export async function getLyrics({ payload }, { signal, fetchImpl = fetch } = {}) {
    if (!payload?.artist || !payload?.title) {
        throw new Error('LRCLIB requires artist and title');
    }

    const params = new URLSearchParams({
        track_name: payload.title,
        artist_name: payload.artist,
    });

    if (payload.album) {
        params.set('album_name', payload.album);
    }
    if (payload.duration) {
        params.set('duration', payload.duration);
    }

    const url = `${BASE_URL}/get?${params.toString()}`;

    const fetchFn = fetchImpl === fetch ? fetchWithTimeout : fetchImpl;
    const resp = await fetchFn(url, {
        signal,
        headers: {
            'User-Agent': 'LyricDisplay/4.4.5 (https://github.com/PeterAlaks/lyric-display-app)',
        },
    });

    if (!resp.ok) {
        if (resp.status === 404) {
            throw new Error('LRCLIB could not find lyrics for this song.');
        }
        const body = await resp.text();
        throw new Error(`LRCLIB lyrics request failed: ${resp.status} ${body}`);
    }

    const json = await resp.json();

    const syncedLyrics = json?.syncedLyrics?.trim();
    const plainLyrics = json?.plainLyrics?.trim();

    if (!syncedLyrics && !plainLyrics) {
        throw new Error('LRCLIB returned no lyric content.');
    }

    const content = syncedLyrics || plainLyrics;

    return {
        provider: definition.id,
        title: json?.trackName || payload.title,
        artist: json?.artistName || payload.artist,
        content,
        sourceUrl: `https://lrclib.net/search?track_name=${encodeURIComponent(payload.title)}&artist_name=${encodeURIComponent(payload.artist)}`,
        credits: json?.instrumental ? 'Instrumental' : null,
        metadata: {
            hasSyncedLyrics: Boolean(syncedLyrics),
            duration: json?.duration || null,
            instrumental: json?.instrumental ?? false,
        },
    };
}