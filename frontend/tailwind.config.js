/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#0b2545',
          navyLight: '#134074',
          gold: '#c2850c',
          goldLight: '#fef3c7',
          goldDark: '#92400e',
          slate: '#1e293b',
          bg: '#f8fafc',
          border: '#e2e8f0',
          ashoka: '#002f6c'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
