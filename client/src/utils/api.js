const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return res.blob();
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Categories
  getCategories: () => request('/categories'),
  getCategoriesAdmin: () => request('/categories/admin'),
  getSubcategories: (catId) => request(`/categories/${catId}/subcategories`),
  createCategory: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  createSubcategory: (data) => request('/categories/subcategories', { method: 'POST', body: JSON.stringify(data) }),
  updateSubcategory: (id, data) => request(`/categories/subcategories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubcategory: (id) => request(`/categories/subcategories/${id}`, { method: 'DELETE' }),

  // Sentences
  getSentencesAdmin: (params) => request(`/sentences/admin?${new URLSearchParams(params)}`),
  getSentenceAdmin: (id) => request(`/sentences/admin/${id}`),
  createSentence: (data) => request('/sentences', { method: 'POST', body: JSON.stringify(data) }),
  updateSentence: (id, data) => request(`/sentences/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSentence: (id) => request(`/sentences/${id}`, { method: 'DELETE' }),
  bulkSentences: (data) => request('/sentences/bulk', { method: 'POST', body: JSON.stringify(data) }),

  // Practice
  getNextSentence: (params) => request(`/practice/next?${new URLSearchParams(params || {})}`),
  getHint: (id) => request(`/practice/${id}/hint`),
  submitAnswer: (data) => request('/practice/submit', { method: 'POST', body: JSON.stringify(data) }),
  getPracticeStats: (params) => request(`/practice/stats?${new URLSearchParams(params || {})}`),

  // Dashboard
  getStudentDashboard: () => request('/dashboard/student'),
  getLeaderboard: (params) => request(`/dashboard/leaderboard?${new URLSearchParams(params || {})}`),
  getMistakes: (params) => request(`/dashboard/mistakes?${new URLSearchParams(params || {})}`),

  // Homework
  getStudentHomework: () => request('/homework/student'),
  getHomeworkSentences: (id) => request(`/homework/${id}/sentences`),
  completeHomework: (id, data) => request(`/homework/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  getHomeworkAdmin: () => request('/homework/admin'),
  createHomework: (data) => request('/homework', { method: 'POST', body: JSON.stringify(data) }),
  assignHomework: (id, data) => request(`/homework/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  deleteHomework: (id) => request(`/homework/${id}`, { method: 'DELETE' }),

  // Admin
  getAdminDashboard: () => request('/admin/dashboard'),
  getStudents: () => request('/admin/students'),
  getStudentReport: (id) => request(`/admin/students/${id}`),
  resetStudent: (id) => request(`/admin/students/${id}/reset`, { method: 'POST' }),
  getSettings: () => request('/admin/settings'),
  updateSettings: (data) => request('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getLevels: () => request('/admin/levels'),
  updateLevels: (data) => request('/admin/levels', { method: 'PUT', body: JSON.stringify(data) }),
  getBatches: () => request('/admin/batches'),
  createBatch: (data) => request('/admin/batches', { method: 'POST', body: JSON.stringify(data) }),
  exportSentences: () => request('/admin/export'),
  exportStudents: () => request('/admin/export/students'),
  
  // Upload (special - uses FormData)
  uploadFile: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/admin/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },
};
