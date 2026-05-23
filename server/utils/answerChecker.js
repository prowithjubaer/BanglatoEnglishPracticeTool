/**
 * PRO English BD - Answer Checker
 * Simple, clean, NO PAID API
 * 
 * Only checks against admin-approved accepted answers.
 * Two results: "correct" or "not_matched"
 * 
 * Modes:
 * - exact: case-insensitive, trimmed comparison
 * - flexible: ignores punctuation, extra spaces, apostrophe variants
 */

/**
 * Basic normalization: lowercase + trim + collapse spaces
 */
function normalizeBasic(text) {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Flexible normalization: removes punctuation, normalizes contractions
 */
function normalizeFlexible(text) {
  if (!text) return '';
  let normalized = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // Remove common punctuation
    .replace(/[.,!?;:'""\u201C\u201D\u2018\u2019\u2014\u2013\-]/g, '')
    // Normalize apostrophes
    .replace(/\u2019/g, "'")
    // Normalize common contractions (handle missing apostrophe)
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
    .replace(/\bits\b/g, "it's")
    .replace(/\btheyre\b/g, "they're")
    .replace(/\byoure\b/g, "you're")
    .replace(/\bwere\b(?!n)/g, "we're")
    .replace(/\bthats\b/g, "that's")
    .replace(/\bwhats\b/g, "what's")
    .replace(/\blets\b/g, "let's")
    .replace(/\bwheres\b/g, "where's")
    .replace(/\bwhos\b/g, "who's")
    .replace(/\bhows\b/g, "how's")
    .replace(/\btheres\b/g, "there's")
    .trim();

  // Handle "everyday" vs "every day"
  normalized = normalized.replace(/\beveryday\b/g, 'every day');

  // Remove remaining punctuation that might have survived
  normalized = normalized.replace(/['"]/g, '');

  return normalized;
}

/**
 * Check student answer against accepted answers
 * 
 * @param {string} studentAnswer - The student's submitted answer
 * @param {string[]} acceptedAnswers - Admin-approved accepted answers
 * @param {string} mode - 'exact' or 'flexible'
 * @returns {{ result: 'correct'|'not_matched', matchedAnswer: string|null }}
 */
function checkAnswer(studentAnswer, acceptedAnswers, mode = 'flexible') {
  if (!studentAnswer || !acceptedAnswers || acceptedAnswers.length === 0) {
    return { result: 'not_matched', matchedAnswer: null };
  }

  const studentNormalized = mode === 'exact' 
    ? normalizeBasic(studentAnswer) 
    : normalizeFlexible(studentAnswer);

  for (const accepted of acceptedAnswers) {
    const acceptedNormalized = mode === 'exact'
      ? normalizeBasic(accepted)
      : normalizeFlexible(accepted);

    if (studentNormalized === acceptedNormalized) {
      return { result: 'correct', matchedAnswer: accepted };
    }
  }

  return { result: 'not_matched', matchedAnswer: null };
}

module.exports = { checkAnswer, normalizeBasic, normalizeFlexible };
