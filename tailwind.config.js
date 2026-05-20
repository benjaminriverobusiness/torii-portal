/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#08090f',
          2: '#0d0e17',
          3: '#111220',
          card: 'rgba(255,255,255,0.03)',
        },
        accent: {
          DEFAULT: '#e5182b',
          dim: 'rgba(229,24,43,0.10)',
          border: 'rgba(229,24,43,0.22)',
        },
        text: {
          1: '#f0f1f7',
          2: '#8a8c9e',
          3: '#555669',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          strong: 'rgba(255,255,255,0.12)',
        },
      },
      fontFamily: {
        head: ['Bricolage Grotesque', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
