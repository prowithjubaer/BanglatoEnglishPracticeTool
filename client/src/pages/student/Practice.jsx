import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Practice() {
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [sentence, setSentence] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [premiumLocked, setPremiumLocked] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, not_matched: 0, xp: 0 });
  // Word bank state
  const [selectedWords, setSelectedWords] = useState([]);
  const [availableWords, setAvailableWords] = useState([]);
  const inputRef = useRef(null);

  const mode = searchParams.get('mode') || '';
  const categoryId = searchParams.get('category_id') || '';
  const subcategoryId = searchParams.get('subcategory_id') || '';

  const loadNext = async () => {
    setLoading(true);
    setResult(null);
    setAnswer('');
    setSelectedWords([]);
    try {
      const params = {};
      if (mode) params.mode = mode;
      if (categoryId) params.category_id = categoryId;
      if (subcategoryId) params.subcategory_id = subcategoryId;
      const data = await api.getNextSentence(params);
      if (data.completed) { setCompleted(true); setSentence(null); }
      else if (data.premium_locked) { setPremiumLocked(true); setSentence(null); }
      else {
        setSentence(data);
        setCompleted(false);
        setPremiumLocked(false);
        // Setup word bank if applicable
        if (data.word_bank && data.word_bank.length > 0) {
          setAvailableWords(shuffleArray([...data.word_bank]));
        } else {
          setAvailableWords([]);
        }
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) { toast.error('Failed to load sentence'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadNext(); }, [mode, categoryId, subcategoryId]);

  const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Word bank handlers
  const addWord = (word, idx) => {
    setSelectedWords([...selectedWords, word]);
    setAvailableWords(availableWords.filter((_, i) => i !== idx));
  };

  const removeWord = (word, idx) => {
    setAvailableWords([...availableWords, word]);
    setSelectedWords(selectedWords.filter((_, i) => i !== idx));
  };

  const getSubmitAnswer = () => {
    if (sentence?.practice_mode === 'word_bank') {
      return selectedWords.join(' ');
    }
    return answer.trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submitAnswer = getSubmitAnswer();
    if (!submitAnswer || !sentence) return;
    setSubmitting(true);
    try {
      const res = await api.submitAnswer({ sentence_id: sentence.id, answer: submitAnswer });
      setResult(res);
      if (res.result === 'correct') {
        setSessionStats(p => ({ ...p, correct: p.correct + 1, xp: p.xp + (res.xp_earned || 0) }));
      } else {
        setSessionStats(p => ({ ...p, not_matched: p.not_matched + 1 }));
      }
      refreshUser();
    } catch (err) { toast.error('Failed to submit'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <StudentLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></StudentLayout>;

  if (premiumLocked) return (
    <StudentLayout>
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-brand-navy mb-3">Premium Content</h2>
        <p className="text-gray-600 mb-6 font-bangla">এই practice set Premium students-দের জন্য। Guided practice, homework, revision এবং fluency tools unlock করতে Premium Batch-এ join করুন।</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="#" className="btn-primary">Join Premium</a>
          <a href="https://wa.me/8801334556130" target="_blank" rel="noopener noreferrer" className="btn-outline flex items-center gap-2 justify-center">💬 WhatsApp</a>
        </div>
      </div>
    </StudentLayout>
  );

  if (completed) return (
    <StudentLayout>
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-brand-navy mb-3">দারুণ কাজ করেছেন!</h2>
        <p className="text-gray-600 mb-2 font-bangla">আজকের জন্য আর কোনো sentence নেই।</p>
        <div className="bg-green-50 rounded-xl p-4 mb-6 inline-block">
          <p className="text-green-700 font-medium font-bangla">✅ {sessionStats.correct} সঠিক | ❌ {sessionStats.not_matched} মেলেনি | ⭐ {sessionStats.xp} XP</p>
        </div>
        <div className="flex gap-3 justify-center">
          <a href="/dashboard" className="btn-primary">Dashboard-এ যান</a>
          <a href="/categories" className="btn-outline">অন্য Category</a>
        </div>
      </div>
    </StudentLayout>
  );

  return (
    <StudentLayout>
      {/* Session bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {sentence?.category_name && <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">{sentence.category_name}</span>}
          {sentence?.subcategory_name && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">{sentence.subcategory_name}</span>}
          {sentence?.difficulty && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${sentence.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : sentence.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : sentence.difficulty === 'Hard' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>{sentence.difficulty}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-600">✅ {sessionStats.correct}</span>
          <span className="text-orange-500">❌ {sessionStats.not_matched}</span>
          <span className="text-amber-600">⭐ {sessionStats.xp}</span>
        </div>
      </div>

      {/* Practice Card */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Bangla Sentence */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b">
            <p className="text-xs text-gray-500 mb-1 font-bangla">ক্লাসে শেখানো structure অনুযায়ী translate করুন</p>
            <p className="text-xl md:text-2xl font-bangla text-brand-navy font-semibold leading-relaxed">{sentence?.bangla_sentence}</p>
          </div>

          {/* Learning Mode Hints */}
          {sentence?.homework_mode === 'learning' && !result && (
            <div className="px-6 pt-4 space-y-2">
              {sentence.structure_hint && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-indigo-600 font-medium">📐 Structure: <span className="text-indigo-800">{sentence.structure_hint}</span></p>
                </div>
              )}
              {sentence.first_word_hint && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-700 font-medium">💡 First word: <span className="font-bold">{sentence.first_word_hint}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Answer Area */}
          <div className="p-6">
            {!result ? (
              <form onSubmit={handleSubmit}>
                {/* TYPING MODE */}
                {(sentence?.practice_mode === 'typing' || !sentence?.practice_mode) && (
                  <div className="mb-4">
                    <input ref={inputRef} type="text" value={answer} onChange={e => setAnswer(e.target.value)}
                      placeholder="English translation লিখুন..."
                      className="input-field text-lg" disabled={submitting} autoComplete="off" />
                  </div>
                )}

                {/* WORD BANK MODE */}
                {sentence?.practice_mode === 'word_bank' && (
                  <div className="mb-4">
                    {/* Selected words (answer area) */}
                    <div className="min-h-[56px] bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-3 mb-3 flex flex-wrap gap-2">
                      {selectedWords.length === 0 && (
                        <p className="text-gray-400 text-sm font-bangla">নিচের words থেকে সঠিক ক্রমে select করুন</p>
                      )}
                      {selectedWords.map((word, idx) => (
                        <button key={idx} type="button" onClick={() => removeWord(word, idx)}
                          className="bg-brand-navy text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                          {word} ✕
                        </button>
                      ))}
                    </div>
                    {/* Available words */}
                    <div className="flex flex-wrap gap-2">
                      {availableWords.map((word, idx) => (
                        <button key={idx} type="button" onClick={() => addWord(word, idx)}
                          className="bg-white border-2 border-brand-navy/20 text-brand-navy px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-navy hover:text-white transition-colors">
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* FILL IN THE BLANK MODE */}
                {sentence?.practice_mode === 'fill_blank' && (
                  <div className="mb-4">
                    {sentence.fill_blank_hint && (
                      <p className="text-gray-600 mb-2 font-medium text-sm">
                        {sentence.fill_blank_hint.split('___').map((part, i, arr) => (
                          <span key={i}>
                            {part}
                            {i < arr.length - 1 && <span className="inline-block mx-1 w-24 border-b-2 border-brand-navy"></span>}
                          </span>
                        ))}
                      </p>
                    )}
                    <input ref={inputRef} type="text" value={answer} onChange={e => setAnswer(e.target.value)}
                      placeholder="Missing word(s) লিখুন..."
                      className="input-field text-lg" disabled={submitting} autoComplete="off" />
                    <p className="text-xs text-gray-400 mt-1 font-bangla">পুরো sentence লিখুন, শুধু missing word নয়</p>
                  </div>
                )}

                {/* MIXED MODE */}
                {sentence?.practice_mode === 'mixed' && (
                  <div className="mb-4">
                    {sentence.fill_blank_hint && (
                      <p className="text-sm text-gray-500 mb-2 font-bangla">Hint: {sentence.fill_blank_hint}</p>
                    )}
                    {sentence.word_bank && sentence.word_bank.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-xs text-gray-400">Words:</span>
                        {sentence.word_bank.map((w, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{w}</span>
                        ))}
                      </div>
                    )}
                    <input ref={inputRef} type="text" value={answer} onChange={e => setAnswer(e.target.value)}
                      placeholder="English translation লিখুন..."
                      className="input-field text-lg" disabled={submitting} autoComplete="off" />
                  </div>
                )}

                <button type="submit"
                  disabled={(!answer.trim() && selectedWords.length === 0) || submitting}
                  className="btn-primary w-full disabled:opacity-50 text-base py-3">
                  {submitting ? 'Checking...' : 'Submit Answer'}
                </button>
              </form>
            ) : (
              <ResultDisplay result={result} onNext={loadNext} />
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}

// ============================================
// RESULT DISPLAY (2-tier: Correct / Not Matched)
// ============================================
function ResultDisplay({ result, onNext }) {
  const isCorrect = result.result === 'correct';

  return (
    <div>
      {isCorrect ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">✅</span>
            <div>
              <h3 className="text-lg font-bold text-green-700">সঠিক হয়েছে!</h3>
              {result.xp_earned > 0 && <span className="text-sm text-green-600 font-medium">+{result.xp_earned} XP পেয়েছেন</span>}
            </div>
          </div>
          <p className="text-green-700 font-bangla">{result.feedback}</p>
          {result.mastered && (
            <p className="mt-2 text-green-600 font-bold font-bangla">🏆 অসাধারণ! আপনি এই sentence টি master করেছেন!</p>
          )}
        </div>
      ) : (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">📝</span>
            <h3 className="text-lg font-bold text-orange-700 font-bangla">Expected format-এ মেলেনি</h3>
          </div>
          <p className="text-orange-700 font-bangla mb-3">{result.feedback}</p>

          {/* Student's answer */}
          <div className="bg-white rounded-lg p-3 mb-3 border border-orange-100">
            <p className="text-xs text-gray-500 mb-1 font-bangla">আপনার উত্তর:</p>
            <p className="text-orange-600">{result.submitted_answer}</p>
          </div>

          {/* Accepted answers */}
          {result.accepted_answers && result.accepted_answers.length > 0 && (
            <div className="bg-white rounded-lg p-3 mb-3 border border-green-100">
              <p className="text-xs text-gray-500 mb-1 font-bangla">Expected answers:</p>
              {result.accepted_answers.map((a, i) => (
                <p key={i} className="text-green-700 font-medium text-sm">✓ {a}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Advanced Version */}
      {result.advanced_version && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-purple-600 mb-1 font-medium font-bangla">🌟 আরো সুন্দরভাবে বলা যায়:</p>
          <p className="text-purple-800 font-medium">{result.advanced_version}</p>
        </div>
      )}

      {/* Explanation */}
      {result.explanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-blue-600 mb-1 font-medium">📖 Explanation:</p>
          <p className="text-blue-800 text-sm">{result.explanation}</p>
        </div>
      )}

      {/* Structure hint (shown after not_matched) */}
      {!isCorrect && result.structure_hint && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-indigo-600 font-medium">📐 Structure: <span className="text-indigo-800">{result.structure_hint}</span></p>
        </div>
      )}

      {/* Review note */}
      {result.review_note && <p className="text-xs text-gray-500 mb-3 italic font-bangla">{result.review_note}</p>}

      {/* Encouragement */}
      {!isCorrect && result.encouragement && (
        <p className="text-sm text-orange-600 mb-4 font-bangla font-medium">{result.encouragement}</p>
      )}

      <button onClick={onNext} className="btn-primary w-full text-base py-3">
        Next Sentence →
      </button>
    </div>
  );
}
