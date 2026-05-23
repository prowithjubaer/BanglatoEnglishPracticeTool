import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function StudentNav() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { to: '/categories', label: 'Practice', icon: '✍️' },
    { to: '/homework', label: 'Homework', icon: '📝' },
    { to: '/mistakes', label: 'Mistakes', icon: '📕' },
    { to: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  ];

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-brand-navy hidden sm:block">PRO English BD</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <Link key={l.to} to={l.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === l.to ? 'bg-brand-red/10 text-brand-red' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span className="mr-1">{l.icon}</span>{l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full">
              <span className="text-amber-600 text-sm font-semibold">{user?.total_xp || 0} XP</span>
              <span className="text-xs">🔥 {user?.streak || 0}</span>
            </div>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              <div className="w-8 h-8 bg-brand-navy rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            </button>
            {menuOpen && (
              <div className="absolute top-14 right-4 bg-white rounded-xl shadow-lg border p-2 min-w-[160px]">
                <p className="px-3 py-2 text-sm font-medium text-gray-700">{user?.name}</p>
                <hr className="my-1" />
                {user?.role === 'admin' && <Link to="/admin" className="block px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">Admin Panel</Link>}
                <button onClick={() => { logout(); navigate('/login'); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Logout</button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto">
          {links.map(l => (
            <Link key={l.to} to={l.to}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${location.pathname === l.to ? 'bg-brand-red/10 text-brand-red' : 'text-gray-500 hover:bg-gray-50'}`}>
              {l.icon} {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function AdminNav() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/admin', label: 'Dashboard', icon: '📊' },
    { to: '/admin/sentences', label: 'Sentences', icon: '📝' },
    { to: '/admin/categories', label: 'Categories', icon: '📁' },
    { to: '/admin/homework', label: 'Homework', icon: '📋' },
    { to: '/admin/students', label: 'Students', icon: '👥' },
    { to: '/admin/upload', label: 'Upload', icon: '📤' },
    { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <header className="bg-brand-navy sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-red rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">P</span>
              </div>
              <span className="font-bold text-white text-sm hidden sm:block">Admin Panel</span>
            </Link>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map(l => (
              <Link key={l.to} to={l.to}
                className={`px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${location.pathname === l.to ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>
                {l.icon} <span className="hidden lg:inline">{l.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="text-xs text-gray-300 hover:text-white">Student View</Link>
            <button onClick={() => { logout(); navigate('/login'); }} className="text-xs text-red-300 hover:text-red-200 ml-2">Logout</button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function StudentLayout({ children }) {
  return (
    <div className="min-h-screen bg-brand-light">
      <StudentNav />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
