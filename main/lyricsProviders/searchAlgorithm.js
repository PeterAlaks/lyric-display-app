let knownArtistsList = [];
let knownArtistsLoaded = false;
let normalizedKnownArtists = [];
let normalizedArtistTokens = [];
const artistTokenIndex = new Map();
const artistTrigramIndex = new Map();
let artistIndexesBuilt = false;

const normalizationCache = new Map();
const MAX_CACHE_SIZE = 1000;
const ARTIST_CANDIDATE_LIMIT = 60;

try {
    const module = await import('../../shared/data/knownArtists.json', {
        with: { type: 'json' },
    });
    knownArtistsList = module.default || [];
    knownArtistsLoaded = true;
    console.log(`[SearchAlgorithm] Loaded ${knownArtistsList.length} known artists`);
} catch (err) {
    console.warn('[SearchAlgorithm] Failed to load knownArtists.json, artist inference will be limited:', err.message);
}

/**
 * Normalize text for comparison: remove accents, punctuation, extra spaces
 * Results are cached for performance
 */
function normalizeText(text) {
    if (!text) return '';

    if (normalizationCache.has(text)) {
        return normalizationCache.get(text);
    }

    const normalized = text
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (normalizationCache.size >= MAX_CACHE_SIZE) {
        const firstKey = normalizationCache.keys().next().value;
        normalizationCache.delete(firstKey);
    }
    normalizationCache.set(text, normalized);

    return normalized;
}

/**
 * Ensure the normalized artist cache is populated once
 */
function ensureNormalizedArtists() {
    if (!knownArtistsLoaded) return [];

    if (normalizedKnownArtists.length !== knownArtistsList.length) {
        normalizedKnownArtists = knownArtistsList.map((artist) => normalizeText(artist));
        artistIndexesBuilt = false; // invalidate indexes when source list changes
    }

    return normalizedKnownArtists;
}

/**
 * Build fast lookup structures for artist matching:
 * - tokens per artist
 * - token -> artist indexes
 * - trigram -> artist indexes (cheap similarity prefilter)
 */
function ensureArtistIndexes() {
    const normalizedArtists = ensureNormalizedArtists();
    if (!normalizedArtists.length) return normalizedArtists;
    if (artistIndexesBuilt && normalizedArtistTokens.length === normalizedArtists.length) {
        return normalizedArtists;
    }

    normalizedArtistTokens = new Array(normalizedArtists.length);
    artistTokenIndex.clear();
    artistTrigramIndex.clear();

    normalizedArtists.forEach((artist, idx) => {
        const tokens = getMeaningfulWords(artist);
        normalizedArtistTokens[idx] = tokens;

        tokens.forEach((token) => {
            const list = artistTokenIndex.get(token) || [];
            list.push(idx);
            artistTokenIndex.set(token, list);
        });

        const trigrams = getTrigrams(artist);
        trigrams.forEach((tri) => {
            const list = artistTrigramIndex.get(tri) || [];
            list.push(idx);
            artistTrigramIndex.set(tri, list);
        });
    });

    artistIndexesBuilt = true;
    return normalizedArtists;
}

function getArtistLikelihood(candidate) {
    const normalized = normalizeText(candidate);
    if (!normalized || /\d/.test(normalized)) return 0;

    const tokens = getMeaningfulWords(normalized);
    if (tokens.length === 0 || tokens.length > 5) return 0;

    const normalizedArtists = ensureNormalizedArtists();
    if (normalizedArtists.includes(normalized)) return 1;

    let bestScore = 0;
    for (const artist of normalizedArtists) {
        if (artist === normalized) return 1;
        if (artist.includes(normalized) || normalized.includes(artist)) {
            bestScore = Math.max(bestScore, 0.9);
            continue;
        }
        const score = fuzzyMatch(artist, normalized, 0.85);
        if (score > bestScore) bestScore = score;
    }

    if (bestScore > 0) return bestScore;
    if (tokens.length >= 2 && tokens.length <= 4) return 0.55;
    return 0;
}

function scoreExplicitSplit({ title, artist, baseConfidence, source = 'explicit_split' }) {
    const titleNorm = normalizeText(title);
    const artistNorm = normalizeText(artist);
    if (!titleNorm || !artistNorm) return null;

    const artistLikelihood = getArtistLikelihood(artistNorm);
    const titleAsArtistLikelihood = getArtistLikelihood(titleNorm);
    const titleWords = getMeaningfulWords(titleNorm);

    if (artistLikelihood <= 0) return null;

    const titleSignal = titleWords.length > 0 ? Math.min(0.2, titleWords.length * 0.04) : 0;
    const score = baseConfidence + (artistLikelihood * 0.35) + titleSignal - (titleAsArtistLikelihood * 0.2);

    return {
        inferredTitle: titleNorm,
        inferredArtist: artistNorm,
        confidence: Math.min(0.97, baseConfidence + (artistLikelihood * 0.08)),
        source,
        score,
    };
}

function addInterpretation(interpretations, interpretation) {
    if (!interpretation?.inferredTitle) return;

    const normalized = {
        inferredTitle: normalizeText(interpretation.inferredTitle),
        inferredArtist: interpretation.inferredArtist ? normalizeText(interpretation.inferredArtist) : null,
        confidence: Math.max(0, Math.min(0.99, interpretation.confidence || 0)),
        source: interpretation.source || 'unknown',
        score: interpretation.score ?? interpretation.confidence ?? 0,
    };
    if (!normalized.inferredTitle) return;

    const key = `${normalized.inferredTitle}|${normalized.inferredArtist || ''}`;
    const existingIndex = interpretations.findIndex((item) =>
        `${item.inferredTitle}|${item.inferredArtist || ''}` === key
    );

    if (existingIndex === -1) {
        interpretations.push(normalized);
        return;
    }

    if ((normalized.score || 0) > (interpretations[existingIndex].score || 0)) {
        interpretations[existingIndex] = normalized;
    }
}

function collectRawQueryInterpretations(query) {
    const raw = String(query || '').trim();
    const interpretations = [];
    if (!raw) return interpretations;

    const quotedTitleFirst = raw.match(/^\s*["“”](.+?)["“”]\s*(?:\(([^)]*)\))?\s*(?:by\s+)?(.+?)\s*$/i);
    if (quotedTitleFirst) {
        addInterpretation(interpretations, scoreExplicitSplit({
            title: quotedTitleFirst[2] ? `${quotedTitleFirst[1]} ${quotedTitleFirst[2]}` : quotedTitleFirst[1],
            artist: quotedTitleFirst[3],
            baseConfidence: 0.94,
            source: 'quoted_title_artist',
        }));
    }

    const quotedTitleSecond = raw.match(/^\s*(.+?)\s+["“”](.+?)["“”]\s*(?:\(([^)]*)\))?\s*$/i);
    if (quotedTitleSecond) {
        addInterpretation(interpretations, scoreExplicitSplit({
            title: quotedTitleSecond[3] ? `${quotedTitleSecond[2]} ${quotedTitleSecond[3]}` : quotedTitleSecond[2],
            artist: quotedTitleSecond[1],
            baseConfidence: 0.9,
            source: 'artist_quoted_title',
        }));
    }

    const byMatches = Array.from(raw.matchAll(/\s+by\s+/gi));
    const byMatch = byMatches.at(-1);
    if (byMatch && byMatch.index > 0) {
        const title = raw.slice(0, byMatch.index).trim();
        const artist = raw.slice(byMatch.index + byMatch[0].length).trim();
        if (title && artist) {
            addInterpretation(interpretations, scoreExplicitSplit({
                title,
                artist,
                baseConfidence: 0.92,
                source: 'title_by_artist',
            }));
        }
    }

    const separatorParts = raw
        .split(/\s+(?:[-\u2013\u2014|:•]|\/)\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (separatorParts.length >= 2) {
        const left = separatorParts[0];
        const right = separatorParts.slice(1).join(' - ');
        const baseConfidence = separatorParts.length === 2 ? 0.86 : 0.8;
        addInterpretation(interpretations, scoreExplicitSplit({
            title: left,
            artist: right,
            baseConfidence,
            source: 'separator_title_artist',
        }));
        addInterpretation(interpretations, scoreExplicitSplit({
            title: right,
            artist: left,
            baseConfidence,
            source: 'separator_artist_title',
        }));
    }

    interpretations.sort((a, b) => (b.score || 0) - (a.score || 0));
    return interpretations;
}

/**
 * Split text into words
 */
function getWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Check if a word exists as a complete word (not substring) in text
 */
function containsWholeWord(text, word) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
}

/**
 * Comprehensive stop words list
 * Music terms like "remix", "live", "acoustic" are meaningful for distinguishing versions
 */
const STOP_WORDS = new Set([
    // Articles & prepositions
    'the', 'a', 'an', 'of', 'to', 'in', 'by', 'with', 'for', 'from', 'at', 'on', 'as', 'is', 'be',
    // Conjunctions
    'and', 'or', 'but', 'nor', 'yet', 'so',
    // Common verbs & auxiliaries
    'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
    // Pronouns & common words
    'it', 'that', 'this', 'i', 'you', 'he', 'she', 'we', 'they', 'all', 'some', 'any', 'no', 'not', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
]);

const VERSION_TERMS = {
    live: ['live', 'concert', 'session'],
    acoustic: ['acoustic', 'stripped', 'unplugged'],
    remix: ['remix', 'mix'],
    instrumental: ['instrumental', 'karaoke'],
    radio_edit: ['radio edit', 'edit'],
    cover: ['cover'],
    demo: ['demo'],
    remastered: ['remaster', 'remastered'],
    extended: ['extended', 'deluxe'],
};

const VERSION_TERM_ORDER = Object.keys(VERSION_TERMS);

/**
 * Extract meaningful words
 */
function getMeaningfulWords(text) {
    const words = getWords(text);
    return words.filter(w => !STOP_WORDS.has(w) && w.length >= 2);
}

/**
 * Generate trigrams for a string (used to cheaply prefilter candidates)
 */
function getTrigrams(text) {
    const trigrams = new Set();
    if (!text || text.length < 3) return trigrams;
    for (let i = 0; i < text.length - 2; i++) {
        trigrams.add(text.slice(i, i + 3));
    }
    return trigrams;
}

/**
 * Retrieve a reduced set of plausible artist candidates using token/trigram indexes.
 * Falls back to the full list (capped) if indexes produce nothing.
 */
function getArtistCandidates(normalizedQuery, meaningfulWords, limit = ARTIST_CANDIDATE_LIMIT) {
    const normalizedArtists = ensureArtistIndexes();
    if (!normalizedArtists.length) return [];

    const candidateScores = new Map();
    const bump = (idx, score) => {
        candidateScores.set(idx, (candidateScores.get(idx) || 0) + score);
    };

    // Token hits are strong signals
    meaningfulWords.forEach((word) => {
        const hits = artistTokenIndex.get(word);
        if (hits) {
            hits.forEach((idx) => bump(idx, 3));
        }
    });

    // Trigram overlap to catch partial matches
    const queryTrigrams = getTrigrams(normalizedQuery);
    queryTrigrams.forEach((tri) => {
        const hits = artistTrigramIndex.get(tri);
        if (hits) {
            hits.forEach((idx) => bump(idx, 1));
        }
    });

    // If nothing matched, provide a bounded fallback to avoid empty candidate sets
    if (candidateScores.size === 0) {
        const count = Math.min(normalizedArtists.length, limit);
        return Array.from({ length: count }, (_, i) => i);
    }

    const scored = Array.from(candidateScores.entries());
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, limit).map(([idx]) => idx);
}


/**
 * Levenshtein distance
 */
export function levenshteinDistance(str1, str2, maxDistance = 10) {
    const len1 = str1.length;
    const len2 = str2.length;

    if (Math.abs(len1 - len2) > maxDistance) {
        return maxDistance + 1;
    }

    let prev = Array(len2 + 1).fill(0).map((_, i) => i);

    for (let i = 1; i <= len1; i++) {
        let curr = [i];

        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost
            );
        }

        if (Math.min(...curr) > maxDistance) {
            return maxDistance + 1;
        }

        prev = curr;
    }

    return prev[len2];
}

/**
 * Fuzzy match with adaptive thresholds for different string lengths
 * - Short strings (< 5 chars): much more lenient
 * - Medium strings (5-15 chars): standard
 * - Long strings (> 15 chars): stricter
 */
export function fuzzyMatch(str1, str2, baseThreshold = 0.7) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;

    const maxLen = Math.max(str1.length, str2.length);
    const minLen = Math.min(str1.length, str2.length);

    if (minLen === 0) return 0;
    if (maxLen / minLen > 3 && maxLen > 8) {
        return 0;
    }

    let threshold = baseThreshold;
    if (maxLen < 5) {
        threshold = Math.max(0.5, baseThreshold - 0.2);
    } else if (maxLen > 15) {
        threshold = Math.min(0.8, baseThreshold + 0.1);
    }

    const maxDistance = Math.ceil(maxLen * (1 - threshold));
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase(), maxDistance);

    if (distance > maxDistance) return 0;

    const similarity = 1 - (distance / maxLen);
    return similarity >= threshold ? similarity : 0;
}

/**
 * Bigram similarity - good for catching partial matches
 */
export function bigramSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0;

    const bigrams1 = new Set();
    for (let i = 0; i < s1.length - 1; i++) {
        bigrams1.add(s1[i] + s1[i + 1]);
    }

    let matches = 0;
    const total = s2.length - 1;

    for (let i = 0; i < total; i++) {
        if (bigrams1.has(s2[i] + s2[i + 1])) {
            matches++;
        }
    }

    return total > 0 ? matches / total : 0;
}


/**
 * Analyze query to infer artist and title
 * Strategy:
 * 1. Check for explicit delimiters (" by ", " - ") - prefer rightmost occurrence
 * 2. Try to match against known artists (exact substring, then fuzzy)
 * 3. If no artist found, treat entire query as title
 * 
 * @param {string} query - The search query
 * @param {Object} options - Configuration options
 * @param {number} options.artistMatchThreshold - Minimum similarity for artist matching (default: 0.65)
 * @param {number} options.wordMatchThreshold - Minimum similarity for word-to-artist matching (default: 0.75)
 * @returns {Object} Query analysis with inferred artist and title
 */
export function analyzeQuery(query, options = {}) {
    const {
        artistMatchThreshold = 0.65,
        wordMatchThreshold = 0.75,
    } = options;

    const normalized = normalizeText(query);
    const words = getWords(normalized);
    const meaningfulWords = getMeaningfulWords(normalized);
    const versionTokens = extractVersionTokens(normalized);

    if (!normalized) {
        return {
            rawQuery: query,
            normalizedQuery: normalized,
            words: [],
            meaningfulWords: [],
            versionTokens: [],
            interpretations: [],
            inferredArtist: null,
            inferredTitle: null,
            confidence: 0,
        };
    }

    const interpretations = collectRawQueryInterpretations(query);
    let inferredArtist = null;
    let inferredTitle = null;
    let confidence = 0;

    let skipArtistInference = false;

    if (interpretations.length > 0) {
        const bestInterpretation = interpretations[0];
        inferredTitle = bestInterpretation.inferredTitle;
        inferredArtist = bestInterpretation.inferredArtist;
        confidence = bestInterpretation.confidence;
    } else if (normalized.includes(' by ')) {
        skipArtistInference = true;
    }

    if (!inferredArtist && !skipArtistInference && knownArtistsLoaded && meaningfulWords.length >= 1) {
        const normalizedArtists = ensureArtistIndexes();
        const candidateIndexes = getArtistCandidates(normalized, meaningfulWords);

        // Phase 1: Exact substring match (prefer longest match) within candidates
        let bestMatch = null;
        let bestLength = 0;
        for (const idx of candidateIndexes) {
            const artist = normalizedArtists[idx];
            if (normalized.includes(artist) && artist.length > bestLength) {
                bestMatch = artist;
                bestLength = artist.length;
            }
        }

        if (bestMatch) {
            inferredArtist = bestMatch;
            const artistWords = getWords(bestMatch);
            const remainingWords = words.filter(w => !artistWords.includes(w));
            inferredTitle = remainingWords.join(' ').trim() || normalized;
            confidence = 0.75;
            addInterpretation(interpretations, {
                inferredTitle,
                inferredArtist,
                confidence,
                source: 'known_artist_exact',
                score: confidence,
            });
        } else {
            // Phase 2: Fuzzy matching (candidate-limited)
            let bestFuzzyMatch = null;
            let bestFuzzyScore = 0;
            let bestWordMatch = null;
            let bestWordScore = 0;

            for (const idx of candidateIndexes) {
                const artist = normalizedArtists[idx];

                // Cheap length gate to avoid hopeless comparisons
                const maxLen = Math.max(artist.length, normalized.length);
                const minLen = Math.min(artist.length, normalized.length);
                if (minLen === 0 || (maxLen / Math.max(minLen, 1) > 3 && maxLen > 8)) {
                    continue;
                }

                const queryScore = fuzzyMatch(artist, normalized, artistMatchThreshold);
                if (queryScore > bestFuzzyScore) {
                    bestFuzzyMatch = artist;
                    bestFuzzyScore = queryScore;
                }

                for (const word of meaningfulWords) {
                    const wordScore = fuzzyMatch(word, artist, wordMatchThreshold);
                    if (wordScore > bestFuzzyScore) {
                        bestFuzzyMatch = artist;
                        bestFuzzyScore = wordScore;
                    }
                    if (wordScore > bestWordScore) {
                        bestWordMatch = artist;
                        bestWordScore = wordScore;
                    }
                }
            }

            const highWordThreshold = Math.max(wordMatchThreshold, 0.8);
            const highQueryThreshold = Math.max(artistMatchThreshold + 0.1, 0.8);
            const preferWordHit = bestWordScore >= highWordThreshold;
            const allowQueryMatch = normalized.length >= 8 && bestFuzzyScore >= highQueryThreshold;

            let chosenMatch = null;
            let chosenScore = 0;

            if (preferWordHit) {
                chosenMatch = bestWordMatch;
                chosenScore = bestWordScore;
            } else if (allowQueryMatch) {
                chosenMatch = bestFuzzyMatch;
                chosenScore = bestFuzzyScore;
            }

            if (chosenMatch && chosenScore >= artistMatchThreshold) {
                inferredArtist = chosenMatch;
                const artistWords = getWords(chosenMatch);
                const remainingWords = words.filter(w => !artistWords.includes(w));
                inferredTitle = remainingWords.join(' ').trim() || normalized;
                confidence = chosenScore * 0.7;
                addInterpretation(interpretations, {
                    inferredTitle,
                    inferredArtist,
                    confidence,
                    source: 'known_artist_fuzzy',
                    score: confidence,
                });
            }
        }
    }

    if (!inferredTitle) {
        inferredTitle = normalized;
        confidence = inferredArtist ? confidence : 0.5;
        addInterpretation(interpretations, {
            inferredTitle,
            inferredArtist,
            confidence,
            source: inferredArtist ? 'artist_inferred_title_fallback' : 'title_only',
            score: confidence,
        });
    }

    interpretations.sort((a, b) => (b.score || b.confidence || 0) - (a.score || a.confidence || 0));
    const bestInterpretation = interpretations[0];
    if (bestInterpretation) {
        inferredTitle = bestInterpretation.inferredTitle;
        inferredArtist = bestInterpretation.inferredArtist;
        confidence = bestInterpretation.confidence;
    }

    return {
        rawQuery: query,
        normalizedQuery: normalized,
        words,
        meaningfulWords,
        versionTokens,
        interpretations: interpretations.map(({ score, ...interpretation }) => interpretation),
        inferredArtist,
        inferredTitle,
        confidence,
        hasKnownArtists: knownArtistsLoaded,
    };
}

/**
 * Calculate relevance score for a database item against query
 * Uses multi-tier scoring system with clear priorities
 * 
 * @param {Object} item - The database item to score
 * @param {Object} queryAnalysis - Analyzed query from analyzeQuery()
 * @param {Object} options - Scoring configuration
 * @returns {Object} Score, signals, and exactness indicator
 */
export function calculateRelevanceScore(item, queryAnalysis, options = {}) {
    const {
        artistMismatchPenalty = 0.12,
        minWordMatchRatio = 0.25,
        bigramThreshold = 0.3,
        fuzzyMatchThreshold = 0.65,
        positionPenaltyWeight = 0.002,
    } = options;

    const {
        normalizedQuery,
        meaningfulWords,
        inferredArtist,
        inferredTitle,
        confidence,
        versionTokens = [],
    } = queryAnalysis;
    const interpretations = Array.isArray(queryAnalysis.interpretations) && queryAnalysis.interpretations.length > 0
        ? queryAnalysis.interpretations
        : [{ inferredArtist, inferredTitle, confidence, source: 'legacy_inferred' }];

    const titleNorm = normalizeText(item.title || '');
    const artistNorm = normalizeText(item.artist || '');
    const itemVersionTokens = getItemVersionTokens(item, titleNorm);

    let score = 0;
    const signals = {};
    let isExact = false;
    const quality = getProviderQualitySignals(item);
    const explicitSearchMatch = getExplicitSearchMatch(item);

    // ===== TIER 1: Exact Matches (Highest Priority) =====
    if (titleNorm === normalizedQuery) {
        return {
            score: clampScore(0.86 + quality.scoreDelta),
            signals: { exactTitleMatch: true, ...quality.signals },
            isExact: true,
        };
    }
    if (artistNorm === normalizedQuery) {
        return {
            score: clampScore(0.76 + quality.scoreDelta),
            signals: { exactArtistMatch: true, ...quality.signals },
            isExact: true,
        };
    }

    const exactInterpretation = interpretations.find((interpretation) =>
        interpretation?.inferredArtist
        && interpretation?.inferredTitle
        && titleNorm === interpretation.inferredTitle
        && artistNorm === interpretation.inferredArtist
    );
    if (exactInterpretation) {
        return {
            score: clampScore(0.94 + quality.scoreDelta),
            signals: {
                exactCombinedMatch: true,
                matchedInterpretation: summarizeInterpretation(exactInterpretation),
                ...quality.signals,
            },
            isExact: true,
        };
    }

    if (explicitSearchMatch?.field === 'lyrics') {
        const lyricScore = clampScore(explicitSearchMatch.score);
        score += 0.62 * lyricScore;
        signals.lyricTextMatch = {
            score: lyricScore,
            exactPhrase: Boolean(explicitSearchMatch.exactPhrase),
        };
        if (explicitSearchMatch.exactPhrase) {
            score += 0.18;
            isExact = true;
        }
    }

    // ===== TIER 2: Substring Matches =====
    if (titleNorm.includes(normalizedQuery)) {
        score += 0.18;
        signals.titleContainsQuery = true;
    }
    if (artistNorm.includes(normalizedQuery)) {
        score += 0.12;
        signals.artistContainsQuery = true;
    }

    // ===== TIER 3: Inferred Artist/Title Matching =====    
    const interpretationMatches = interpretations
        .map((interpretation) => scoreInterpretationMatch({
            artistMismatchPenalty,
            artistNorm,
            fuzzyMatchThreshold,
            interpretation,
            titleNorm,
        }))
        .filter(Boolean);

    interpretationMatches.sort((a, b) => b.scoreDelta - a.scoreDelta);
    const bestInterpretationMatch = interpretationMatches[0];
    if (bestInterpretationMatch && bestInterpretationMatch.scoreDelta !== 0) {
        score += bestInterpretationMatch.scoreDelta;
        Object.assign(signals, bestInterpretationMatch.signals);
        if (bestInterpretationMatch.isExact) {
            isExact = true;
        }
    }

    // ===== TIER 4: Meaningful Word Matching =====    
    if (meaningfulWords.length > 0) {
        let matchedWords = 0;
        let wholeWordMatches = 0;
        const titleWords = getWords(titleNorm);
        const artistWords = getWords(artistNorm);
        const allDbWords = [...titleWords, ...artistWords];

        for (const queryWord of meaningfulWords) {
            let wordMatched = false;

            if (containsWholeWord(titleNorm, queryWord) || containsWholeWord(artistNorm, queryWord)) {
                matchedWords++;
                wholeWordMatches++;
                wordMatched = true;
                continue;
            }

            if (titleNorm.includes(queryWord) || artistNorm.includes(queryWord)) {
                matchedWords++;
                wordMatched = true;
                continue;
            }

            if (!wordMatched) {
                for (const dbWord of allDbWords) {
                    if (fuzzyMatch(queryWord, dbWord, 0.7) > 0.7) {
                        matchedWords++;
                        break;
                    }
                }
            }
        }

        const matchRatio = matchedWords / meaningfulWords.length;
        const wholeWordRatio = wholeWordMatches / meaningfulWords.length;

        if (matchRatio >= minWordMatchRatio) {
            const baseScore = 0.16 * matchRatio;
            const wholeWordBonus = 0.04 * wholeWordRatio;
            score += baseScore + wholeWordBonus;
            signals.wordMatches = {
                matched: matchedWords,
                wholeWord: wholeWordMatches,
                total: meaningfulWords.length,
                ratio: matchRatio,
                wholeWordRatio: wholeWordRatio
            };
        }
    }

    // ===== TIER 5: Bigram Similarity (Fallback) =====    
    const titleBigram = bigramSimilarity(titleNorm, normalizedQuery);
    const artistBigram = bigramSimilarity(artistNorm, normalizedQuery);

    if (titleBigram > bigramThreshold) {
        score += 0.08 * titleBigram;
        signals.titleBigramMatch = titleBigram;
    }
    if (artistBigram > bigramThreshold) {
        score += 0.06 * artistBigram;
        signals.artistBigramMatch = artistBigram;
    }

    // ===== TIER 6: Context-Based Boosts =====    
    const queryHasYear = /\b(?:19|20)\d{2}\b/.test(normalizedQuery);
    if (queryHasYear && item.provider === 'lrclib') {
        score += 0.02;
        signals.modernContentBoost = true;
    }

    const queryHasHymnIndicator = /hymn|traditional|praise|gospel|spiritual/i.test(normalizedQuery);
    if (queryHasHymnIndicator && item.provider === 'openHymnal') {
        score += 0.02;
        signals.traditionalContentBoost = true;
    }

    // ===== TIER 7: Version/Arrangement Matching =====
    const requestedVersions = new Set(versionTokens);
    const itemVersions = new Set(itemVersionTokens);
    if (requestedVersions.size > 0) {
        const matchedVersions = [];
        const missingVersions = [];

        requestedVersions.forEach((token) => {
            if (itemVersions.has(token)) {
                matchedVersions.push(token);
            } else {
                missingVersions.push(token);
            }
        });

        if (matchedVersions.length > 0) {
            score += 0.12 * matchedVersions.length;
            signals.versionMatches = matchedVersions;
        }

        if (missingVersions.length > 0) {
            score -= 0.12 * missingVersions.length;
            signals.versionMissing = missingVersions;
        }

        const extraVersions = itemVersionTokens.filter((token) => !requestedVersions.has(token));
        if (extraVersions.length > 0) {
            score -= 0.03 * extraVersions.length;
            signals.extraVersionSignals = extraVersions;
        }
    } else if (itemVersionTokens.length > 0) {
        score -= 0.025 * itemVersionTokens.length;
        signals.unrequestedVersionPenalty = itemVersionTokens;
    }

    // ===== TIER 8: Provider/lyric Availability Quality =====
    score += quality.scoreDelta;
    Object.assign(signals, quality.signals);

    // ===== TIER 9: Position Penalty =====
    const positionPenalty = (item._resultIndex || 0) * -positionPenaltyWeight;
    score += positionPenalty;
    if (positionPenalty < 0) {
        signals.positionPenalty = Math.abs(positionPenalty);
    }

    return { score: clampScore(score), signals, isExact };
}

function scoreInterpretationMatch({
    artistMismatchPenalty,
    artistNorm,
    fuzzyMatchThreshold,
    interpretation,
    titleNorm,
}) {
    if (!interpretation?.inferredTitle) return null;

    const inferredArtist = interpretation.inferredArtist;
    const inferredTitle = interpretation.inferredTitle;
    const confidence = interpretation.confidence || 0.5;
    let scoreDelta = 0;
    const signals = {
        matchedInterpretation: summarizeInterpretation(interpretation),
    };
    let isExact = false;

    if (inferredArtist && inferredTitle) {
        const artistMatch = fuzzyMatch(artistNorm, inferredArtist, fuzzyMatchThreshold);
        if (artistMatch >= fuzzyMatchThreshold) {
            scoreDelta += 0.32 * artistMatch * (confidence || 0.7);
            signals.artistInferredMatch = artistMatch;
        } else if (confidence > 0.8) {
            const penalty = Math.min(artistMismatchPenalty, artistMismatchPenalty * confidence);
            scoreDelta -= penalty;
            signals.artistMismatchPenalty = penalty;
        }

        const titleMatch = fuzzyMatch(titleNorm, inferredTitle, fuzzyMatchThreshold);
        if (titleMatch >= fuzzyMatchThreshold) {
            scoreDelta += 0.38 * titleMatch;
            signals.titleInferredMatch = titleMatch;
        }

        if ((signals.artistInferredMatch || 0) >= 0.8 && (signals.titleInferredMatch || 0) >= 0.8) {
            isExact = true;
            scoreDelta += 0.12;
            signals.strongCombinedMatch = true;
        }
    } else if (inferredTitle && !inferredArtist) {
        const titleMatch = fuzzyMatch(titleNorm, inferredTitle, fuzzyMatchThreshold);
        if (titleMatch >= fuzzyMatchThreshold) {
            scoreDelta += 0.48 * titleMatch;
            signals.titleInferredMatch = titleMatch;
            if (titleMatch >= 0.85) {
                isExact = true;
            }
        }
    }

    return {
        scoreDelta,
        signals,
        isExact,
    };
}

function clampScore(score) {
    if (!Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(1, score));
}

function getProviderTrustScore(providerId) {
    switch (providerId) {
        case 'lrclib':
            return 1;
        case 'openHymnal':
            return 0.92;
        case 'lyricsOvh':
            return 0.72;
        case 'chartlyrics':
            return 0.5;
        default:
            return 0.65;
    }
}

function getProviderQualitySignals(item) {
    const providerTrust = getProviderTrustScore(item.provider);
    let scoreDelta = (providerTrust - 0.75) * 0.06;
    const signals = { providerTrust };

    if (item.metadata?.hasSyncedLyrics) {
        scoreDelta += 0.04;
        signals.syncedLyricsBoost = true;
    }
    if (item.metadata?.hasPlainLyrics || item.payload?.lrcId || item.payload?.lyricId) {
        scoreDelta += 0.02;
        signals.lyricAvailabilityBoost = true;
    }

    return { scoreDelta, signals };
}

function getExplicitSearchMatch(item) {
    const match = item?.metadata?.searchMatch;
    if (!match || typeof match !== 'object') return null;

    return {
        field: match.field || null,
        score: Number.isFinite(match.score) ? match.score : 0,
        exactPhrase: Boolean(match.exactPhrase),
    };
}

function summarizeInterpretation(interpretation) {
    return {
        title: interpretation.inferredTitle || null,
        artist: interpretation.inferredArtist || null,
        confidence: interpretation.confidence || 0,
        source: interpretation.source || 'unknown',
    };
}


/**
 * Merge and rank results from multiple providers
 * - Score all results
 * - Sort by relevance
 * - Deduplicate (same song from different providers)
 * - Return top N results
 * 
 * @param {Array} chunks - Array of provider result chunks
 * @param {Object} options - Merge configuration
 * @param {number} options.limit - Maximum number of results to return
 * @param {string} options.query - The search query
 * @param {number} options.minScoreThreshold - Minimum score to include (default: adaptive)
 * @param {Object} options.scoringOptions - Options to pass to calculateRelevanceScore
 * @returns {Array} Merged and ranked results
 */
export function mergeResults(chunks, options = {}) {
    const {
        limit = 10,
        query = '',
        minScoreThreshold = null,
        scoringOptions = {},
        onMergeMeta = null,
        providerPenalties = null,
        includeDedupDroppped = false,
        includeDedupDropped = includeDedupDroppped,
    } = options;

    const queryAnalysis = analyzeQuery(query);
    const scoredResults = [];
    const mergeMeta = {
        thresholdApplied: null,
        fallbackApplied: false,
        knownArtistsLoaded,
        knownArtistsCount: knownArtistsList.length,
        providerPenaltiesApplied: false,
        providerPenaltiesAvailable: Boolean(providerPenalties && typeof providerPenalties.get === 'function'),
        inferred: {
            artist: queryAnalysis.inferredArtist,
            title: queryAnalysis.inferredTitle,
            confidence: queryAnalysis.confidence,
            interpretations: queryAnalysis.interpretations || [],
        },
        ranking: {
            totalCandidates: 0,
            returnedCount: 0,
            topCandidates: [],
        },
        lowQualityResults: [],
    };

    chunks.forEach((chunk) => {
        chunk.results.forEach((item, resultIndex) => {
            const { score, signals, isExact } = calculateRelevanceScore(
                { ...item, _resultIndex: resultIndex },
                queryAnalysis,
                scoringOptions
            );

            const providerPenalty = providerPenalties?.get?.(item.provider) || 0;

            scoredResults.push({
                item,
                score,
                rawScore: score,
                providerPenalty,
                signals,
                isExact,
            });
        });
    });

    scoredResults.sort(compareScoredResults);
    mergeMeta.ranking.totalCandidates = scoredResults.length;
    mergeMeta.ranking.topCandidates = scoredResults
        .slice(0, 5)
        .map((scored, index) => summarizeScoredCandidate(scored, index + 1));

    if (process.env.NODE_ENV === 'development' && scoredResults.length > 0) {
        console.log(`\n[LyricsSearch] Query: "${query}"`);
        console.log(`[LyricsSearch] Inferred: "${queryAnalysis.inferredTitle}" by "${queryAnalysis.inferredArtist}" (confidence: ${(queryAnalysis.confidence * 100).toFixed(0)}%)`);
        console.log(`[LyricsSearch] Known artists loaded: ${queryAnalysis.hasKnownArtists}`);
        console.log('[LyricsSearch] Top 5 results:');
        scoredResults.slice(0, 5).forEach((r, i) => {
            console.log(`  ${i + 1}. [${r.score.toFixed(0)}] ${r.item.title} - ${r.item.artist} (${r.item.provider})`);
            console.log(`     Signals:`, r.signals);
        });
    }

    let threshold = minScoreThreshold;
    if (threshold === null) {
        const topScore = scoredResults[0]?.score || 0;
        if (topScore > 0.9) {
            threshold = 0.2;
        } else if (topScore > 0.65) {
            threshold = 0.16;
        } else if (topScore > 0.3) {
            threshold = 0.08;
        } else {
            threshold = 0.03;
        }
    }
    mergeMeta.thresholdApplied = threshold;

    let filtered = scoredResults.filter(r => r.score >= threshold);

    const merged = [];
    const seen = new Map();
    const droppedViaDedup = [];

    if (filtered.length === 0 && scoredResults.length > 0) {
        filtered = scoredResults;
        mergeMeta.fallbackApplied = true;
    }

    for (const scored of filtered) {
        if (merged.length >= limit) break;

        const item = scored.item;
        const dedupKey = buildDedupKey(item);

        const existing = seen.get(dedupKey);
        if (!existing) {
            seen.set(dedupKey, scored);
            merged.push(item);
        } else if (compareScoredResults(scored, existing) < 0) {
            const existingIndex = merged.findIndex(m =>
                buildDedupKey(m) === dedupKey
            );
            if (existingIndex !== -1) {
                const droppedItem = merged[existingIndex];
                if (includeDedupDropped) droppedViaDedup.push(droppedItem);
                merged[existingIndex] = item;
                seen.set(dedupKey, scored);
            }
        } else if (includeDedupDropped) {
            droppedViaDedup.push(item);
        }
    }
    mergeMeta.ranking.returnedCount = merged.length;

    // Collect low quality candidates (below threshold, not already merged)
    const lowQuality = [];
    scoredResults.forEach((scored) => {
        if (scored.score >= threshold) return;
        const dedupKey = buildDedupKey(scored.item);
        if (!seen.has(dedupKey)) {
            lowQuality.push(scored.item);
        }
    });

    if (typeof onMergeMeta === 'function') {
        try {
            onMergeMeta({ ...mergeMeta, lowQualityResults: [...lowQuality, ...droppedViaDedup] });
        } catch (err) {
            console.warn('[LyricsSearch] Failed to publish merge meta:', err?.message || err);
        }
    }

    return merged;
}

/**
 * Clear the normalization cache
 */
export function clearCache() {
    normalizationCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    return {
        normalizationCacheSize: normalizationCache.size,
        knownArtistsLoaded,
        knownArtistsCount: knownArtistsList.length,
    };
}

function buildDedupKey(item) {
    const titleKey = canonicalTitleKey(item.title || '');
    const artistKey = canonicalArtistKey(item.artist || '');
    const providerKey = item.provider || 'unknown';
    const durationKey = durationBucketKey(item.metadata?.duration);
    const snippetKey = lyricFingerprintKey(item.snippet || item.preview || '');
    const versionKey = getItemVersionTokens(item).join(',');

    if (artistKey) {
        return `${titleKey}|${artistKey}|${versionKey}`;
    }

    return `${titleKey}|unknown|${versionKey}|${durationKey || snippetKey || providerKey}`;
}

function compareScoredResults(a, b) {
    const semanticDelta = b.score - a.score;
    if (semanticDelta !== 0) return semanticDelta;

    const exactDelta = Number(b.isExact) - Number(a.isExact);
    if (exactDelta !== 0) return exactDelta;

    const penaltyDelta = (a.providerPenalty || 0) - (b.providerPenalty || 0);
    if (penaltyDelta !== 0) return penaltyDelta;

    return 0;
}

function summarizeScoredCandidate(scored, rank) {
    return {
        rank,
        provider: scored.item.provider || 'unknown',
        title: scored.item.title || '',
        artist: scored.item.artist || '',
        score: roundScore(scored.score),
        rawScore: roundScore(scored.rawScore),
        providerPenalty: scored.providerPenalty || 0,
        isExact: Boolean(scored.isExact),
        signals: scored.signals || {},
    };
}

function roundScore(score) {
    if (!Number.isFinite(score)) return 0;
    return Math.round(score * 10000) / 10000;
}

function canonicalTitleKey(title) {
    const normalized = normalizeText(title);
    if (!normalized) return '';
    return normalized.replace(/\s+/g, '');
}

function canonicalArtistKey(artist) {
    const normalized = normalizeText(artist);
    if (!normalized) return '';

    const withoutFeaturing = normalized
        .replace(/\b(?:feat|featuring|ft)\b.*$/i, '')
        .trim();

    const meaningful = getMeaningfulWords(withoutFeaturing);
    return meaningful.length > 0 ? meaningful.join(' ') : withoutFeaturing;
}

function extractVersionTokens(text) {
    const normalized = normalizeText(text);
    if (!normalized) return [];

    const tokens = new Set();
    VERSION_TERM_ORDER.forEach((key) => {
        const terms = VERSION_TERMS[key];
        if (terms.some((term) => containsVersionTerm(normalized, term))) {
            tokens.add(key);
        }
    });

    return Array.from(tokens);
}

function containsVersionTerm(normalizedText, term) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalizedText);
}

function getItemVersionTokens(item, precomputedTitleNorm = null) {
    const parts = [
        precomputedTitleNorm || normalizeText(item?.title || ''),
        normalizeText(item?.album || ''),
        normalizeText(item?.snippet || ''),
    ];

    if (item?.metadata?.instrumental) {
        parts.push('instrumental');
    }

    if (item?.metadata?.version) {
        parts.push(normalizeText(item.metadata.version));
    }

    return extractVersionTokens(parts.filter(Boolean).join(' '));
}

function durationBucketKey(duration) {
    const numeric = Number(duration);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    return String(Math.round(numeric / 5) * 5);
}

function lyricFingerprintKey(text) {
    const normalized = normalizeText(text);
    if (!normalized) return '';
    return getMeaningfulWords(normalized).slice(0, 12).join(' ');
}
