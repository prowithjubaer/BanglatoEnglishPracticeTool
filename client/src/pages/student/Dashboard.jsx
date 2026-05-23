import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StudentLayout } from '../../components/Layout';
import { api } from '../../utils/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStudentDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <StudentLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></StudentLayout>;
  if (!data) return <StudentLayout><p>Failed to load dashboard</p></StudentLayout>;

  const { user, levelInfo, nextLevel, stats, categoryProgress, weakAreas, pendingHomework } = data;
  const xpProgress = nextLevel ? ((user.total_xp - levelInfo.min_xp) / (nextLevel.min_xp - levelInfo.min_xp)) * 100 : 100;

  return (
    <StudentLayout>
      {/* Welcome & Level */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Welcome back, <span className="text-brand-red">{user.name}</span>!</h1>
        <p className="text-gray-500 text-sm mt-1">Keep practicing every day to improve your English</p>
      </div>

      {/* XP & Level Card */}
      <div className="card mb-6 bg-gradient-to-r from-brand-navy to-slate-700 text-white !border-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-300 text-sm">Level {levelInfo?.level_number}</p>
            <p className="text-xl font-bold">{levelInfo?.badge} {levelInfo?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{user.total_xp} <span className="text-sm text-gray-300">XP</span></p>
            <p className="text-sm text-gray-300">🔥 {user.streak} day streak</p>
          </div>
        </div>
        {nextLevel && (
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>{levelInfo?.name}</span>
              <span>{nextLevel?.name} ({nextLevel?.min_xp} XP)</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2.5">
              <div className="bg-brand-red h-2.5 rounded-full transition-all" style={{width: `${Math.min(xpProgress, 100)}%`}}></div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-brand-red">{stats.today_practiced}</p>
          <p className="text-xs text-gray-500">Practiced Today</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.due_today || 0}</p>
          <p className="text-xs text-gray-500">Due Today</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-green-500">{stats.mastered_count || 0}</p>
          <p className="text-xs text-gray-500">Mastered</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-blue-500">{stats.accuracy}%</p>
          <p className="text-xs text-gray-500">Accuracy</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Link to="/practice" className="card flex items-center gap-3 hover:border-brand-red/30 cursor-pointer">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-xl">✍️</div>
          <div>
            <p className="font-semibold text-brand-navy">Continue Practice</p>
            <p className="text-xs text-gray-500">{stats.new_sentences} new sentences</p>
          </div>
        </Link>
        <Link to="/practice?mode=due" className="card flex items-center gap-3 hover:border-amber-300 cursor-pointer">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-xl">📅</div>
          <div>
            <p className="font-semibold text-brand-navy">Due Review</p>
            <p className="text-xs text-gray-500">{stats.due_today || 0} sentences due</p>
          </div>
        </Link>
        <Link to="/practice?mode=review" className="card flex items-center gap-3 hover:border-purple-300 cursor-pointer">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-xl">🔄</div>
          <div>
            <p className="font-semibold text-brand-navy">Wrong Review</p>
            <p className="text-xs text-gray-500">{stats.wrong_count || 0} to review</p>
          </div>
        </Link>
      </div>

      {/* Pending Homework */}
      {pendingHomework.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-brand-navy mb-3">📝 Pending Homework</h2>
          <div className="space-y-2">
            {pendingHomework.map(hw => (
              <Link key={hw.homework_id} to="/homework" className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-brand-navy">{hw.title}</p>
                  <p className="text-xs text-gray-500">Due: {hw.due_date || 'No deadline'}</p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{hw.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Weak Areas */}
      {weakAreas.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-brand-navy mb-3">⚠️ Needs More Practice</h2>
          <div className="flex flex-wrap gap-2">
            {weakAreas.map((w, i) => (
              <span key={i} className="bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-sm font-medium">
                {w.icon} {w.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category Progress */}
      <div>
        <h2 className="text-lg font-bold text-brand-navy mb-3">📊 Category Progress</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categoryProgress.filter(c => c.total_in_category > 0).slice(0, 8).map(cat => {
            const progress = cat.total_in_category > 0 ? Math.round((cat.mastered / cat.total_in_category) * 100) : 0;
            return (
              <Link key={cat.id} to={`/practice?category_id=${cat.id}`} className="card flex items-center gap-3">
                <span className="text-2xl">{cat.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm text-brand-navy">{cat.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: `${progress}%`}}></div>
                    </div>
                    <span className="text-xs text-gray-500">{progress}%</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </StudentLayout>
  );
}
