/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // The neutral ramp is resolved from the active theme preset
      // (src/theme/palette.ts). Keeping the class names means a preset
      // restyles every authored surface without editing every component.
      colors: {
        neutral: {
          50: 'hsl(var(--geegle-n-50) / <alpha-value>)',
          100: 'hsl(var(--geegle-n-100) / <alpha-value>)',
          200: 'hsl(var(--geegle-n-200) / <alpha-value>)',
          300: 'hsl(var(--geegle-n-300) / <alpha-value>)',
          400: 'hsl(var(--geegle-n-400) / <alpha-value>)',
          500: 'hsl(var(--geegle-n-500) / <alpha-value>)',
          600: 'hsl(var(--geegle-n-600) / <alpha-value>)',
          700: 'hsl(var(--geegle-n-700) / <alpha-value>)',
          800: 'hsl(var(--geegle-n-800) / <alpha-value>)',
          900: 'hsl(var(--geegle-n-900) / <alpha-value>)',
          950: 'hsl(var(--geegle-n-950) / <alpha-value>)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--geegle-border)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
