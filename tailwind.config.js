/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // OpenSMS tokens — surfaces stay near-black; the single accent is
        // signal green. Defined once here + in DESIGN.md; pages use arbitrary
        // values for the neutrals by design (ported layout).
        accent: {
          DEFAULT: '#00D26A',
          deep: '#009E4F',
        },
      },
    },
  },
  plugins: [],
};
