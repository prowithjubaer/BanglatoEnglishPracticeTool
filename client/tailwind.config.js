/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1e293b',
          red: '#e63946',
          pink: '#ff6b8a',
          light: '#f8fafc',
          accent: '#3b82f6',
        }
      },
      fontFamily: {
        bangla: ['Hind Siliguri', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
