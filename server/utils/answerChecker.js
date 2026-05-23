/**
 * PRO English BD - Advanced Answer Checking System
 * NO PAID API - Rule-based similarity, synonym matching, critical words, mistake detection
 */

const db = require('../database');

// ============================================
// NORMALIZATION FUNCTIONS
// ============================================

function normalizeBasic(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeFlexible(text) {
  let normalized = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'""\u201C\u201D\u2018\u2019\u2014\u2013]/g, '')
    .replace(/\u2019/g, "'")
    // Normalize contractions
    .replace(/\bdont\b/g, "don't")
    .replace(/\bdoesnt\b/g, "doesn't")
    .replace(/\bcant\b/g, "can't")
    .replace(/\bwont\b/g, "won't")
    .replace(/\bisnt\b/g, "isn't")
    .replace(/\barent\b/g, "aren't")
    .replace(/\bwasnt\b/g, "wasn't")
    .replace(/\bwerent\b/g, "weren't")
    .replace(/\bhavent\b/g, "haven't")
    .replace(/\bhasnt\b/g, "hasn't")
    .replace(/\bhadnt\b/g, "hadn't")
    .replace(/\bdidnt\b/g, "didn't")
    .replace(/\bwouldnt\b/g, "wouldn't")
    .replace(/\bcouldnt\b/g, "couldn't")
    .replace(/\bshouldnt\b/g, "shouldn't")
    .replace(/\bim\b/g, "i'm")
    .replace(/\bive\b/g, "i've")
    .replace(/\bill\b/g, "i'll")
    .replace(/\bhes\b/g, "he's")
    .replace(/\bshes\b/g, "she's")
    .replace(/\btheyre\b/g, "they're")
    .replace(/\byoure\b/g, "you're")
    .replace(/\bwere\b(?!n)/g, "we're")
    .replace(/\bthats\b/g, "that's")
    .replace(/\bwhats\b/g, "what's")
    .replace(/\blets\b/g, "let's")
    .trim();

  // Handle everyday vs every day
  normalized = normalized.replace(/\beveryday\b/g, 'every day');
  
  return normalized;
}

// ============================================
// LEVENSHTEIN DISTANCE (Edit Distance)
// ============================================

function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ============================================
// SIMILARITY SCORING (Combined approach)
// ============================================

/**
 * Calculate character-level similarity using Levenshtein
 */
function charSimilarity(str1, str2) {
  if (!str1 && !str2) return 100;
  if (!str1 || !str2) return 0;
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(str1, str2);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Calculate token-level similarity (word overlap)
 */
function tokenSimilarity(str1, str2) {
  const tokens1 = str1.split(/\s+/).filter(Boolean);
  const tokens2 = str2.split(/\s+/).filter(Boolean);
  
  if (tokens1.length === 0 && tokens2.length === 0) return 100;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let matchCount = 0;
  const used = new Set();

  for (const t1 of tokens1) {
    for (let i = 0; i < tokens2.length; i++) {
      if (!used.has(i) && t1 === tokens2[i]) {
        matchCount++;
        used.add(i);
        break;
      }
    }
  }

  const maxTokens = Math.max(tokens1.length, tokens2.length);
  return Math.round((matchCount / maxTokens) * 100);
}

/**
 * Calculate token similarity with synonym support
 */
function tokenSimilarityWithSynonyms(str1, str2, synonymGroups) {
  const tokens1 = str1.split(/\s+/).filter(Boolean);
  const tokens2 = str2.split(/\s+/).filter(Boolean);
  
  if (tokens1.length === 0 && tokens2.length === 0) return 100;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let matchCount = 0;
  const used = new Set();

  for (const t1 of tokens1) {
    let matched = false;
    for (let i = 0; i < tokens2.length; i++) {
      if (used.has(i)) continue;
      if (t1 === tokens2[i]) {
        matchCount++;
        used.add(i);
        matched = true;
        break;
      }
      // Check synonyms
      if (areSynonyms(t1, tokens2[i], synonymGroups)) {
        matchCount += 0.9; // Synonym match = 90% credit
        used.add(i);
        matched = true;
        break;
      }
    }
  }

  const maxTokens = Math.max(tokens1.length, tokens2.length);
  return Math.round((matchCount / maxTokens) * 100);
}

/**
 * Check if two words are synonyms
 */
function areSynonyms(word1, word2, synonymGroups) {
  if (!synonymGroups || synonymGroups.length === 0) return false;
  for (const group of synonymGroups) {
    const words = group.words.split(/[,/|]/).map(w => w.trim().toLowerCase());
    if (words.includes(word1.toLowerCase()) && words.includes(word2.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Combined similarity score (weighted average of char + token similarity)
 */
function calculateSimilarity(studentAnswer, correctAnswer, synonymGroups = []) {
  const normStudent = normalizeFlexible(studentAnswer);
  const normCorrect = normalizeFlexible(correctAnswer);

  // Exact match after normalization
  if (normStudent === normCorrect) return 100;

  const charSim = charSimilarity(normStudent, normCorrect);
  const tokenSim = synonymGroups.length > 0
    ? tokenSimilarityWithSynonyms(normStudent, normCorrect, synonymGroups)
    : tokenSimilarity(normStudent, normCorrect);

  // Weighted: 40% character, 60% token (word-level matters more for language)
  return Math.round(charSim * 0.4 + tokenSim * 0.6);
}

/**
 * Get best similarity score against all correct answers
 */
function getBestSimilarity(studentAnswer, correctAnswers, synonymGroups = []) {
  let bestScore = 0;
  let bestMatch = null;

  for (const correct of correctAnswers) {
    const score = calculateSimilarity(studentAnswer, correct, synonymGroups);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = correct;
    }
  }

  return { score: bestScore, bestMatch };
}

// ============================================
// CRITICAL WORDS CHECKING
// ============================================

/**
 * Check if student answer contains required words
 * Returns: { passed: boolean, missingWords: string[] }
 */
function checkRequiredWords(studentAnswer, requiredWordsStr) {
  if (!requiredWordsStr || !requiredWordsStr.trim()) return { passed: true, missingWords: [] };
  
  const normalizedAnswer = normalizeFlexible(studentAnswer);
  const words = requiredWordsStr.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  const missingWords = [];

  for (const word of words) {
    // Check if word (or its common forms) exists in answer
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (!regex.test(normalizedAnswer)) {
      missingWords.push(word);
    }
  }

  return { passed: missingWords.length === 0, missingWords };
}

/**
 * Check if student answer contains forbidden words
 * Returns: { passed: boolean, foundForbidden: string[] }
 */
function checkForbiddenWords(studentAnswer, forbiddenWordsStr) {
  if (!forbiddenWordsStr || !forbiddenWordsStr.trim()) return { passed: true, foundForbidden: [] };
  
  const normalizedAnswer = normalizeFlexible(studentAnswer);
  const words = forbiddenWordsStr.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  const foundForbidden = [];

  for (const word of words) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(normalizedAnswer)) {
      foundForbidden.push(word);
    }
  }

  return { passed: foundForbidden.length === 0, foundForbidden };
}

// ============================================
// MISTAKE TYPE DETECTION
// ============================================

/**
 * Detect common mistake types by comparing student answer to closest correct answer
 */
function detectMistakeType(studentAnswer, correctAnswer, grammarPattern) {
  const normStudent = normalizeFlexible(studentAnswer);
  const normCorrect = normalizeFlexible(correctAnswer);
  const studentWords = normStudent.split(/\s+/);
  const correctWords = normCorrect.split(/\s+/);

  const mistakes = [];

  // 1. Check word count difference (missing/extra word)
  const wordDiff = studentWords.length - correctWords.length;
  if (wordDiff < -1) mistakes.push('missing_word');
  else if (wordDiff > 1) mistakes.push('extra_word');

  // 2. Check for article mistakes
  const articles = ['a', 'an', 'the'];
  const studentArticles = studentWords.filter(w => articles.includes(w));
  const correctArticles = correctWords.filter(w => articles.includes(w));
  if (studentArticles.length !== correctArticles.length || 
      studentArticles.join(' ') !== correctArticles.join(' ')) {
    mistakes.push('article_mistake');
  }

  // 3. Check for preposition mistakes
  const prepositions = ['in', 'on', 'at', 'to', 'for', 'from', 'with', 'by', 'of', 'about', 'into', 'through', 'during', 'before', 'after'];
  const studentPreps = studentWords.filter(w => prepositions.includes(w));
  const correctPreps = correctWords.filter(w => prepositions.includes(w));
  if (studentPreps.join(' ') !== correctPreps.join(' ')) {
    mistakes.push('preposition_mistake');
  }

  // 4. Tense/verb form detection
  if (grammarPattern) {
    const pattern = grammarPattern.toLowerCase();
    
    // Past tense check
    if (pattern.includes('past')) {
      const pastIndicators = ['was', 'were', 'did', 'had'];
      const hasStudentPast = studentWords.some(w => pastIndicators.includes(w)) || 
                             studentWords.some(w => w.endsWith('ed'));
      const hasCorrectPast = correctWords.some(w => pastIndicators.includes(w)) || 
                             correctWords.some(w => w.endsWith('ed'));
      if (hasCorrectPast && !hasStudentPast) {
        mistakes.push('tense_mistake');
        mistakes.push('verb_form_mistake');
      }
    }
    
    // Present simple check
    if (pattern.includes('present simple')) {
      const presentIndicators = ['do', 'does'];
      // Check 3rd person s/es
      if (correctWords.some(w => w.endsWith('s') && !['is','was','has','this','his'].includes(w))) {
        const correctVerbs = correctWords.filter(w => w.endsWith('s') && !['is','was','has','this','his','always','sometimes'].includes(w));
        for (const v of correctVerbs) {
          const base = v.slice(0, -1);
          if (studentWords.includes(base) && !studentWords.includes(v)) {
            mistakes.push('subject_verb_agreement');
            break;
          }
        }
      }
    }

    // Future tense check
    if (pattern.includes('future')) {
      const futureIndicators = ['will', 'shall', 'going to'];
      const hasStudentFuture = studentWords.includes('will') || studentWords.includes('shall') ||
                               normStudent.includes('going to');
      const hasCorrectFuture = correctWords.includes('will') || correctWords.includes('shall') ||
                               normCorrect.includes('going to');
      if (hasCorrectFuture && !hasStudentFuture) {
        mistakes.push('tense_mistake');
      }
    }

    // Continuous tense check
    if (pattern.includes('continuous')) {
      const hasStudentIng = studentWords.some(w => w.endsWith('ing'));
      const hasCorrectIng = correctWords.some(w => w.endsWith('ing'));
      if (hasCorrectIng && !hasStudentIng) {
        mistakes.push('tense_mistake');
        mistakes.push('verb_form_mistake');
      }
    }

    // Perfect tense check  
    if (pattern.includes('perfect')) {
      const perfectIndicators = ['have', 'has', 'had'];
      const hasStudentPerfect = studentWords.some(w => perfectIndicators.includes(w));
      const hasCorrectPerfect = correctWords.some(w => perfectIndicators.includes(w));
      if (hasCorrectPerfect && !hasStudentPerfect) {
        mistakes.push('tense_mistake');
      }
    }
  }

  // 5. Word order check (if same words but different order)
  const studentSorted = [...studentWords].sort().join(' ');
  const correctSorted = [...correctWords].sort().join(' ');
  if (studentSorted === correctSorted && normStudent !== normCorrect) {
    mistakes.push('word_order_mistake');
  }

  // 6. Spelling check (find close words that don't match)
  for (const sw of studentWords) {
    if (!correctWords.includes(sw)) {
      // Check if it's a slight misspelling of a correct word
      for (const cw of correctWords) {
        if (!studentWords.includes(cw)) {
          const dist = levenshteinDistance(sw, cw);
          if (dist === 1 || dist === 2) {
            mistakes.push('spelling_mistake');
            break;
          }
        }
      }
    }
  }

  // 7. If only capitalization/punctuation differs
  if (studentAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim() === 
      correctAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim() &&
      studentAnswer !== correctAnswer) {
    return ['capitalization_punctuation_only'];
  }

  // Remove duplicates
  const uniqueMistakes = [...new Set(mistakes)];
  
  // Default if no specific type detected
  if (uniqueMistakes.length === 0 && normStudent !== normCorrect) {
    // Check if meaning might have changed significantly
    const sim = tokenSimilarity(normStudent, normCorrect);
    if (sim < 50) {
      uniqueMistakes.push('meaning_changed');
    } else {
      uniqueMistakes.push('other');
    }
  }

  return uniqueMistakes;
}

// ============================================
// MAIN ANSWER CHECKING FUNCTION (3-tier)
// ============================================

/**
 * Main answer check function
 * Returns: { resultType: 'correct'|'almost_correct'|'wrong', similarity, mistakeTypes, details }
 */
function checkAnswer(studentAnswer, correctAnswers, options = {}) {
  const {
    checkingMode = 'flexible',
    partialMatchEnabled = true,
    correctThreshold = 90,
    partialThreshold = 70,
    requiredWords = '',
    forbiddenWords = '',
    grammarPattern = '',
    synonymGroups = [],
    almostCorrectEnabled = true,
  } = options;

  if (!studentAnswer || !correctAnswers || correctAnswers.length === 0) {
    return { 
      resultType: 'wrong', 
      isCorrect: false, 
      similarity: 0, 
      mistakeTypes: [], 
      matchedAnswer: null,
      details: {}
    };
  }

  // Step 1: Exact match check (after normalization based on mode)
  let exactMatch = false;
  let matchedAnswer = null;

  if (checkingMode === 'exact') {
    const normStudent = normalizeBasic(studentAnswer);
    for (const ans of correctAnswers) {
      if (normalizeBasic(ans) === normStudent) {
        exactMatch = true;
        matchedAnswer = ans;
        break;
      }
    }
  } else {
    // Flexible or AI mode
    const normStudent = normalizeFlexible(studentAnswer);
    for (const ans of correctAnswers) {
      if (normalizeFlexible(ans) === normStudent) {
        exactMatch = true;
        matchedAnswer = ans;
        break;
      }
    }
  }

  if (exactMatch) {
    // Even with exact match, check forbidden words
    const forbiddenCheck = checkForbiddenWords(studentAnswer, forbiddenWords);
    if (!forbiddenCheck.passed) {
      return {
        resultType: 'wrong',
        isCorrect: false,
        similarity: 95,
        mistakeTypes: ['forbidden_word_used'],
        matchedAnswer,
        details: { foundForbidden: forbiddenCheck.foundForbidden }
      };
    }

    return {
      resultType: 'correct',
      isCorrect: true,
      similarity: 100,
      mistakeTypes: [],
      matchedAnswer,
      details: {}
    };
  }

  // Step 2: Similarity-based checking
  const { score: bestSimilarity, bestMatch } = getBestSimilarity(studentAnswer, correctAnswers, synonymGroups);
  matchedAnswer = bestMatch;

  // Step 3: Check critical words
  const requiredCheck = checkRequiredWords(studentAnswer, requiredWords);
  const forbiddenCheck = checkForbiddenWords(studentAnswer, forbiddenWords);

  // Step 4: Detect mistake types
  const mistakeTypes = bestMatch 
    ? detectMistakeType(studentAnswer, bestMatch, grammarPattern)
    : ['meaning_changed'];

  // Step 5: Determine result type
  let resultType = 'wrong';
  let adjustedSimilarity = bestSimilarity;

  // Penalty for missing required words
  if (!requiredCheck.passed) {
    const penalty = requiredCheck.missingWords.length * 15;
    adjustedSimilarity = Math.max(0, adjustedSimilarity - penalty);
  }

  // Penalty for forbidden words
  if (!forbiddenCheck.passed) {
    const penalty = forbiddenCheck.foundForbidden.length * 20;
    adjustedSimilarity = Math.max(0, adjustedSimilarity - penalty);
    if (!mistakeTypes.includes('forbidden_word_used')) {
      mistakeTypes.push('forbidden_word_used');
    }
  }

  if (adjustedSimilarity >= correctThreshold) {
    // High similarity + no critical word issues = Correct
    if (requiredCheck.passed && forbiddenCheck.passed) {
      resultType = 'correct';
    } else if (almostCorrectEnabled && partialMatchEnabled) {
      resultType = 'almost_correct';
    } else {
      resultType = 'wrong';
    }
  } else if (almostCorrectEnabled && partialMatchEnabled && adjustedSimilarity >= partialThreshold) {
    // Medium similarity = Almost Correct
    resultType = 'almost_correct';
  } else {
    resultType = 'wrong';
  }

  // If almost_correct is disabled, downgrade to wrong
  if (resultType === 'almost_correct' && !almostCorrectEnabled) {
    resultType = 'wrong';
  }

  return {
    resultType,
    isCorrect: resultType === 'correct',
    similarity: adjustedSimilarity,
    mistakeTypes,
    matchedAnswer,
    details: {
      rawSimilarity: bestSimilarity,
      missingWords: requiredCheck.missingWords,
      foundForbidden: forbiddenCheck.foundForbidden,
    }
  };
}

// ============================================
// HELPER: Get synonym groups from DB
// ============================================

function getActiveSynonymGroups() {
  try {
    return db.prepare('SELECT * FROM synonym_groups WHERE is_active = 1').all();
  } catch (e) {
    return [];
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  checkAnswer,
  normalizeBasic,
  normalizeFlexible,
  calculateSimilarity,
  getBestSimilarity,
  checkRequiredWords,
  checkForbiddenWords,
  detectMistakeType,
  levenshteinDistance,
  charSimilarity,
  tokenSimilarity,
  getActiveSynonymGroups,
  areSynonyms,
};
