let knownArtistsList = [];
try {
    const module = await import('../../shared/data/knownArtists.json', {
        with: { type: 'json' },
    });
    knownArtistsList = module.default;
} catch (err) {
    console.error('Failed to load knownArtists.json:', err);
}


/**
 * Normalize text for comparison: remove accents, punctuation, extra spaces
 */
function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Split text into words
 */
function getWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Comprehensive stop words list - includes common words but NOT music-specific terms
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
    // NOTE: NOT including music-specific terms - they're meaningful for version distinction
]);

/**
 * Extract meaningful words (non-stop words, length >= 2)
 */
function getMeaningfulWords(text) {
    const words = getWords(text);
    return words.filter(w => !STOP_WORDS.has(w) && w.length >= 2);
}


/**
 * Levenshtein distance with early termination
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
 * 1. Check for explicit delimiters (" by ", " - ")
 * 2. Try to match against known artists (exact substring, then fuzzy)
 * 3. If no artist found, treat entire query as title
 */
export function analyzeQuery(query) {
    const normalized = normalizeText(query);
    const words = getWords(normalized);
    const meaningfulWords = getMeaningfulWords(normalized);

    if (!normalized) {
        return {
            rawQuery: query,
            normalizedQuery: normalized,
            words: [],
            meaningfulWords: [],
            inferredArtist: null,
            inferredTitle: null,
        };
    }

    let inferredArtist = null;
    let inferredTitle = null;

    if (normalized.includes(' by ')) {
        const [title, artist] = normalized.split(' by ', 2);
        inferredTitle = title.trim();
        inferredArtist = artist.trim();
    } else if (normalized.includes(' - ')) {
        const [title, artist] = normalized.split(' - ', 2);
        inferredTitle = title.trim();
        inferredArtist = artist.trim();
    }

    if (!inferredArtist && meaningfulWords.length >= 1) {
        const normalizedArtists = knownArtistsList.map(a => normalizeText(a));

        let bestMatch = null;
        let bestLength = 0;
        for (const artist of normalizedArtists) {
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
        } else {
            let bestFuzzyMatch = null;
            let bestFuzzyScore = 0;

            for (const artist of normalizedArtists) {

                const score = fuzzyMatch(artist, normalized, 0.65);
                if (score > bestFuzzyScore) {
                    bestFuzzyMatch = artist;
                    bestFuzzyScore = score;
                }

                for (const word of meaningfulWords) {
                    const wordScore = fuzzyMatch(word, artist, 0.75);
                    if (wordScore > bestFuzzyScore) {
                        bestFuzzyMatch = artist;
                        bestFuzzyScore = wordScore;
                    }
                }
            }

            if (bestFuzzyMatch && bestFuzzyScore > 0.65) {
                inferredArtist = bestFuzzyMatch;
                const artistWords = getWords(bestFuzzyMatch);
                const remainingWords = words.filter(w => !artistWords.includes(w));
                inferredTitle = remainingWords.join(' ').trim() || normalized;
            }
        }
    }

    if (!inferredTitle) {
        inferredTitle = normalized;
    }

    return {
        rawQuery: query,
        normalizedQuery: normalized,
        words,
        meaningfulWords,
        inferredArtist,
        inferredTitle,
    };
}

/**
 * Calculate relevance score for a database item against query
 * Uses multi-tier scoring system with clear priorities
 */
export function calculateRelevanceScore(item, queryAnalysis) {
    const { normalizedQuery, meaningfulWords, inferredArtist, inferredTitle } = queryAnalysis;

    const titleNorm = normalizeText(item.title || '');
    const artistNorm = normalizeText(item.artist || '');

    let score = 0;
    const signals = {};
    let isExact = false;

    // ===== TIER 1: Exact Matches (Highest Priority) =====
    if (titleNorm === normalizedQuery) {
        return { score: 1000000, signals: { exactTitleMatch: true }, isExact: true };
    }
    if (artistNorm === normalizedQuery) {
        return { score: 900000, signals: { exactArtistMatch: true }, isExact: true };
    }

    // ===== TIER 2: Substring Matches =====
    if (titleNorm.includes(normalizedQuery)) {
        score += 150000;
        signals.titleContainsQuery = true;
    }
    if (artistNorm.includes(normalizedQuery)) {
        score += 120000;
        signals.artistContainsQuery = true;
    }

    // ===== TIER 3: Inferred Artist/Title Matching =====

    if (inferredArtist && inferredTitle) {

        const artistMatch = fuzzyMatch(artistNorm, inferredArtist, 0.65);
        if (artistMatch > 0.65) {
            score += 250000 * artistMatch;
            signals.artistInferredMatch = artistMatch;
        } else {
            score -= 200000;
            signals.artistMismatchPenalty = true;
        }

        const titleMatch = fuzzyMatch(titleNorm, inferredTitle, 0.65);
        if (titleMatch > 0.65) {
            score += 250000 * titleMatch;
            signals.titleInferredMatch = titleMatch;
        }

        if ((signals.artistInferredMatch || 0) >= 0.8 && (signals.titleInferredMatch || 0) >= 0.8) {
            isExact = true;
        }
    } else if (inferredTitle && !inferredArtist) {
        const titleMatch = fuzzyMatch(titleNorm, inferredTitle, 0.65);
        if (titleMatch > 0.65) {
            score += 250000 * titleMatch;
            signals.titleInferredMatch = titleMatch;
            if (titleMatch >= 0.85) {
                isExact = true;
            }
        }
    }

    // ===== TIER 4: Meaningful Word Matching =====

    if (meaningfulWords.length > 0) {
        let matchedWords = 0;
        const titleWords = getWords(titleNorm);
        const artistWords = getWords(artistNorm);
        const allDbWords = [...titleWords, ...artistWords];

        for (const queryWord of meaningfulWords) {

            if (titleNorm.includes(queryWord) || artistNorm.includes(queryWord)) {
                matchedWords++;
                continue;
            }

            for (const dbWord of allDbWords) {
                if (fuzzyMatch(queryWord, dbWord, 0.7) > 0.7) {
                    matchedWords++;
                    break;
                }
            }
        }

        const matchRatio = matchedWords / meaningfulWords.length;

        if (matchRatio >= 0.25) {
            score += 100000 * matchRatio;
            signals.wordMatches = { matched: matchedWords, total: meaningfulWords.length, ratio: matchRatio };
        }
    }

    // ===== TIER 5: Bigram Similarity (Fallback) =====

    const titleBigram = bigramSimilarity(titleNorm, normalizedQuery);
    const artistBigram = bigramSimilarity(artistNorm, normalizedQuery);

    if (titleBigram > 0.3) {
        score += 40000 * titleBigram;
        signals.titleBigramMatch = titleBigram;
    }
    if (artistBigram > 0.3) {
        score += 30000 * artistBigram;
        signals.artistBigramMatch = artistBigram;
    }

    // ===== TIER 6: Context-Based Boosts =====
    const queryHasYear = /202[0-5]|201[0-9]/.test(normalizedQuery);
    if (queryHasYear && item.provider === 'lrclib') {
        score += 10000;
        signals.modernContentBoost = true;
    }

    const queryHasHymnIndicator = /hymn|traditional|praise|gospel|spiritual/i.test(normalizedQuery);
    if (queryHasHymnIndicator && (item.provider === 'openHymnal' || item.provider === 'hymnary')) {
        score += 10000;
        signals.traditionalContentBoost = true;
    }

    // ===== Position Penalty =====

    const positionPenalty = (item._resultIndex || 0) * -100;
    score += positionPenalty;

    return { score, signals, isExact };
}


/**
 * Merge and rank results from multiple providers
 * - Score all results
 * - Sort by relevance
 * - Deduplicate (same song from different providers)
 * - Return top N results
 */
export function mergeResults(chunks, { limit, query }) {
    const queryAnalysis = analyzeQuery(query);
    const scoredResults = [];

    chunks.forEach((chunk) => {
        chunk.results.forEach((item, resultIndex) => {
            const { score, signals, isExact } = calculateRelevanceScore(
                { ...item, _resultIndex: resultIndex },
                queryAnalysis
            );

            scoredResults.push({
                item,
                score,
                signals,
                isExact,
            });
        });
    });

    scoredResults.sort((a, b) => b.score - a.score);

    if (process.env.NODE_ENV === 'development' && scoredResults.length > 0) {
        console.log(`\n[LyricsSearch] Query: "${query}"`);
        console.log(`[LyricsSearch] Inferred: "${queryAnalysis.inferredTitle}" by "${queryAnalysis.inferredArtist}"`);
        console.log('[LyricsSearch] Top 5 results:');
        scoredResults.slice(0, 5).forEach((r, i) => {
            console.log(`  ${i + 1}. [${r.score.toFixed(0)}] ${r.item.title} - ${r.item.artist} (${r.item.provider})`);
            console.log(`     Signals:`, r.signals);
        });
    }

    const MIN_SCORE_THRESHOLD = 50000;
    const filtered = scoredResults.filter(r => r.score >= MIN_SCORE_THRESHOLD);

    const merged = [];
    const seen = new Set();

    for (const scored of filtered) {
        if (merged.length >= limit) break;

        const item = scored.item;
        const dedupKey = `${normalizeText(item.title)}|${normalizeText(item.artist)}`;

        if (!seen.has(dedupKey)) {
            seen.add(dedupKey);
            merged.push(item);
        }
    }

    return merged;
}
