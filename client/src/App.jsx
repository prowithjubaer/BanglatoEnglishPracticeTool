import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/student/Dashboard';
import Practice from './pages/student/Practice';
import Categories from './pages/student/Categories';
import Homework from './pages/student/Homework';
import Leaderboard from './pages/student/Leaderboard';
import Mistakes from './pages/student/Mistakes';
import AdminDashboard from './pages/admin/Dashboard';
import ManageSentences from './pages/admin/ManageSentences';
import ManageCategories from './pages/admin/ManageCategories';
import ManageHomework from './pages/admin/ManageHomework';
import Students from './pages/admin/Students';
import Settings from './pages/admin/Settings';
import Upload from './pages/admin/Upload';
import ReviewQueue from './pages/admin/ReviewQueue';
import Synonyms from './pages/admin/Synonyms';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
      
      {/* Student Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
      <Route path="/practice" element={<ProtectedRoute><Practice /></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
      <Route path="/homework" element={<ProtectedRoute><Homework /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/mistakes" element={<ProtectedRoute><Mistakes /></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/sentences" element={<ProtectedRoute adminOnly><ManageSentences /></ProtectedRoute>} />
      <Route path="/admin/categories" element={<ProtectedRoute adminOnly><ManageCategories /></ProtectedRoute>} />
      <Route path="/admin/homework" element={<ProtectedRoute adminOnly><ManageHomework /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute adminOnly><Students /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      <Route path="/admin/upload" element={<ProtectedRoute adminOnly><Upload /></ProtectedRoute>} />
      <Route path="/admin/review" element={<ProtectedRoute adminOnly><ReviewQueue /></ProtectedRoute>} />
      <Route path="/admin/synonyms" element={<ProtectedRoute adminOnly><Synonyms /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/login'} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
