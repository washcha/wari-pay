/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          deep: '#144516',
          mid: '#416943',
          lime: '#B0EC70',
          mint: '#D7E2D6',
          cream: '#F5F7F4',
        },
        line: {
          green: '#06C755',
          dark: '#00A94E',
        },
      },
      boxShadow: {
        soft: '0 4px 16px -4px rgba(20, 69, 22, 0.12)',
        card: '0 2px 10px -2px rgba(20, 69, 22, 0.08)',
      },
    },
  },
  plugins: [],
}
