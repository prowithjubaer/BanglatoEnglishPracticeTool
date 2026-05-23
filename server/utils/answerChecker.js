/**
 * Answer checking utility for PRO English BD
 * Supports: exact, flexible, and AI modes
 */

function normalizeBasic(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeFlexible(text) {
  let normalized = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'""\u201C\u201D\u2018\u2019]/g, '')
    .replace(/\u2019/g, "'")
    .replace(/dont/g, "don't")
    .replace(/doesnt/g, "doesn't")
    .replace(/cant/g, "can't")
    .replace(/wont/g, "won't")
    .replace(/isnt/g, "isn't")
    .replace(/arent/g, "aren't")
    .replace(/wasnt/g, "wasn't")
    .replace(/werent/g, "weren't")
    .replace(/havent/g, "haven't")
    .replace(/hasnt/g, "hasn't")
    .replace(/hadnt/g, "hadn't")
    .replace(/didnt/g, "didn't")
    .replace(/wouldnt/g, "wouldn't")
    .replace(/couldnt/g, "couldn't")
    .replace(/shouldnt/g, "shouldn't")
    .replace(/im\b/g, "i'm")
    .replace(/ive\b/g, "i've")
    .replace(/ill\b/g, "i'll")
    .replace(/hes\b/g, "he's")
    .replace(/shes\b/g, "she's")
    .replace(/theyre\b/g, "they're")
    .replace(/were\b(?!n)/g, "we're")
    .replace(/youre\b/g, "you're")
    .trim();

  // Handle everyday vs every day
  normalized = normalized.replace(/everyday/g, 'every day');
  
  return normalized;
}

function checkExact(studentAnswer, correctAnswers) {
  const normalized = normalizeBasic(studentAnswer);
  return correctAnswers.some(ans => normalizeBasic(ans) === normalized);
}

function checkFlexible(studentAnswer, correctAnswers) {
  const normalized = normalizeFlexible(studentAnswer);
  return correctAnswers.some(ans => normalizeFlexible(ans) === normalized);
}

function checkAnswer(studentAnswer, correctAnswers, mode = 'flexible') {
  if (!studentAnswer || !correctAnswers || correctAnswers.length === 0) {
    return { isCorrect: false, matchedAnswer: null };
  }

  let isCorrect = false;
  let matchedAnswer = null;

  switch (mode) {
    case 'exact':
      for (const ans of correctAnswers) {
        if (checkExact(studentAnswer, [ans])) {
          isCorrect = true;
          matchedAnswer = ans;
          break;
        }
      }
      break;
    case 'flexible':
    default:
      for (const ans of correctAnswers) {
        if (checkFlexible(studentAnswer, [ans])) {
          isCorrect = true;
          matchedAnswer = ans;
          break;
        }
      }
      break;
    case 'ai':
      // AI mode falls back to flexible for now
      for (const ans of correctAnswers) {
        if (checkFlexible(studentAnswer, [ans])) {
          isCorrect = true;
          matchedAnswer = ans;
          break;
        }
      }
      break;
  }

  return { isCorrect, matchedAnswer };
}

module.exports = { checkAnswer, normalizeBasic, normalizeFlexible };
