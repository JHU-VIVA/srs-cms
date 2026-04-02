/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        viva: {
          navy: '#0a1628',
          dark: '#0f1d32',
          slate: '#6b7ea0',
          accent: '#4a90d9',
          light: '#c8d6e5',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        viva: {
          "primary": "#4a90d9",
          "secondary": "#6b7ea0",
          "accent": "#c8d6e5",
          "neutral": "#0f1d32",
          "base-100": "#f0f4f8",
          "base-200": "#e2e8f0",
          "base-300": "#cbd5e1",
          "info": "#4a90d9",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
    ],
  },
};
