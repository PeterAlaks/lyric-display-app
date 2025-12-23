let knownArtistsList = [];
let knownArtistsLoaded = false;
let normalizedKnownArtists = [];

const normalizationCache = new Map();
const MAX_CACHE_SIZE = 1000;

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
        .replace(/[^\w\s]/g, ' ')
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
    }

    return normalizedKnownArtists;
}

/**
 * Heuristic to decide if a substring looks like an artist name
 * Helps avoid mis-splitting queries on " by " with generic words
 */
function isLikelyArtistCandidate(candidate) {
    const normalized = normalizeText(candidate);
    if (!normalized) return false;
    if (/\d/.test(normalized)) return false;

    const tokens = getMeaningfulWords(normalized);
    if (tokens.length === 0 || tokens.length > 4) return false;

    const normalizedArtists = ensureNormalizedArtists();

    if (tokens.length === 1) {
        if (normalizedArtists.length === 0) return false;
        if (normalizedArtists.includes(normalized)) return true;
        for (const artist of normalizedArtists) {
            if (fuzzyMatch(artist, normalized, 0.85) >= 0.85) {
                return true;
            }
        }
        return false;
    }

    if (normalizedArtists.length > 0) {
        for (const artist of normalizedArtists) {
            if (artist === normalized) return true;
            if (fuzzyMatch(artist, normalized, 0.85) >= 0.85) {
                return true;
            }
        }
    }

    return tokens.length >= 2;
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

/**
 * Extract meaningful words
 */
function getMeaningfulWords(text) {
    const words = getWords(text);
    return words.filter(w => !STOP_WORDS.has(w) && w.length >= 2);
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

    if (!normalized) {
        return {
            rawQuery: query,
            normalizedQuery: normalized,
            words: [],
            meaningfulWords: [],
            inferredArtist: null,
            inferredTitle: null,
            confidence: 0,
        };
    }

    let inferredArtist = null;
    let inferredTitle = null;
    let confidence = 0;

    let splitApplied = false;
    let skipArtistInference = false;

    if (normalized.includes(' by ')) {
        const lastByIndex = normalized.lastIndexOf(' by ');
        const candidateTitle = normalized.substring(0, lastByIndex).trim();
        const candidateArtist = normalized.substring(lastByIndex + 4).trim();
        if (isLikelyArtistCandidate(candidateArtist)) {
            inferredTitle = candidateTitle;
            inferredArtist = candidateArtist;
            confidence = 0.95;
            splitApplied = true;
        }
        if (!splitApplied) {
            skipArtistInference = true;
        }
    }

    if (!splitApplied && normalized.includes(' - ')) {
        const parts = normalized.split(' - ');
        if (parts.length === 2) {
            inferredTitle = parts[0].trim();
            inferredArtist = parts[1].trim();
            confidence = 0.9;
        } else if (parts.length > 2) {
            inferredTitle = parts[0].trim();
            inferredArtist = parts.slice(1).join(' - ').trim();
            confidence = 0.85;
        }
    }

    if (!inferredArtist && !skipArtistInference && knownArtistsLoaded && meaningfulWords.length >= 1) {
        const normalizedArtists = ensureNormalizedArtists();

        // Phase 1: Exact substring match (prefer longest match)
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
            confidence = 0.75;
        } else {
            // Phase 2: Fuzzy matching (more expensive, only if exact match failed)
            let bestFuzzyMatch = null;
            let bestFuzzyScore = 0;
            let bestWordMatch = null;
            let bestWordScore = 0;

            const searchLimit = normalizedArtists.length;

            for (let i = 0; i < searchLimit; i++) {
                const artist = normalizedArtists[i];

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
            }
        }
    }

    if (!inferredTitle) {
        inferredTitle = normalized;
        confidence = inferredArtist ? confidence : 0.5;
    }

    return {
        rawQuery: query,
        normalizedQuery: normalized,
        words,
        meaningfulWords,
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
        artistMismatchPenalty = 50000,
        minWordMatchRatio = 0.25,
        bigramThreshold = 0.3,
        fuzzyMatchThreshold = 0.65,
        positionPenaltyWeight = 100,
    } = options;

    const { normalizedQuery, meaningfulWords, inferredArtist, inferredTitle, confidence } = queryAnalysis;

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

    if (inferredArtist && inferredTitle && titleNorm === inferredTitle && artistNorm === inferredArtist) {
        return { score: 1100000, signals: { exactCombinedMatch: true }, isExact: true };
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
        const artistMatch = fuzzyMatch(artistNorm, inferredArtist, fuzzyMatchThreshold);
        if (artistMatch >= fuzzyMatchThreshold) {
            score += 250000 * artistMatch * (confidence || 0.7);
            signals.artistInferredMatch = artistMatch;
        } else if (confidence > 0.8) {
            const penalty = Math.min(artistMismatchPenalty, artistMismatchPenalty * confidence);
            score -= penalty;
            signals.artistMismatchPenalty = penalty;
        }

        const titleMatch = fuzzyMatch(titleNorm, inferredTitle, fuzzyMatchThreshold);
        if (titleMatch >= fuzzyMatchThreshold) {
            score += 250000 * titleMatch;
            signals.titleInferredMatch = titleMatch;
        }

        if ((signals.artistInferredMatch || 0) >= 0.8 && (signals.titleInferredMatch || 0) >= 0.8) {
            isExact = true;
            score += 50000;
            signals.strongCombinedMatch = true;
        }
    } else if (inferredTitle && !inferredArtist) {
        const titleMatch = fuzzyMatch(titleNorm, inferredTitle, fuzzyMatchThreshold);
        if (titleMatch >= fuzzyMatchThreshold) {
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
            const baseScore = 100000 * matchRatio;
            const wholeWordBonus = 20000 * wholeWordRatio;
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
        score += 40000 * titleBigram;
        signals.titleBigramMatch = titleBigram;
    }
    if (artistBigram > bigramThreshold) {
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

    // ===== TIER 7: Position Penalty =====
    const positionPenalty = (item._resultIndex || 0) * -positionPenaltyWeight;
    score += positionPenalty;
    if (positionPenalty < 0) {
        signals.positionPenalty = Math.abs(positionPenalty);
    }

    return { score, signals, isExact };
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
    } = options;

    const queryAnalysis = analyzeQuery(query);
    const scoredResults = [];
    const mergeMeta = {
        thresholdApplied: null,
        fallbackApplied: false,
        knownArtistsLoaded,
        knownArtistsCount: knownArtistsList.length,
        providerPenaltiesApplied: Boolean(providerPenalties && typeof providerPenalties.get === 'function'),
        inferred: {
            artist: queryAnalysis.inferredArtist,
            title: queryAnalysis.inferredTitle,
            confidence: queryAnalysis.confidence,
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
            const adjustedScore = score - providerPenalty;

            scoredResults.push({
                item,
                score: adjustedScore,
                rawScore: score,
                providerPenalty,
                signals,
                isExact,
            });
        });
    });

    scoredResults.sort((a, b) => b.score - a.score);

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
        if (topScore > 500000) {
            threshold = 100000;
        } else if (topScore > 200000) {
            threshold = 50000;
        } else if (topScore > 50000) {
            threshold = 20000;
        } else {
            threshold = 5000;
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
            seen.set(dedupKey, scored.score);
            merged.push(item);
        } else if (scored.score > existing) {
            const existingIndex = merged.findIndex(m =>
                buildDedupKey(m) === dedupKey
            );
            if (existingIndex !== -1) {
                const droppedItem = merged[existingIndex];
                if (includeDedupDroppped) droppedViaDedup.push(droppedItem);
                merged[existingIndex] = item;
                seen.set(dedupKey, scored.score);
            }
        } else if (includeDedupDroppped) {
            droppedViaDedup.push(item);
        }
    }

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
    const titleKey = normalizeText(item.title || '');
    const artistKey = normalizeText(item.artist || '');
    const providerKey = item.provider || 'unknown';
    const durationKey = item.metadata?.duration ? String(item.metadata.duration) : '';
    const snippetKey = item.snippet ? normalizeText(item.snippet).slice(0, 40) : '';

    if (artistKey) {
        return `${titleKey}|${artistKey}`;
    }

    return `${titleKey}|${providerKey}|${durationKey || snippetKey}`;
}