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
        // Delivered tokens - surfaces stay near-black; the single accent is
        // signal green. Defined once here + in DESIGN.md; pages use arbitrary
        // values for the neutrals by design (ported layout).
        accent: {
          DEFAULT: '#00D26A',
          deep: '#009E4F',
        },
      },
      // Motion tokens - strong curves for deliberate UI motion (built-in CSS
      // easings are too weak). Enter = out-strong, on-screen movement =
      // in-out-strong. Keep durations <=300ms for UI, longer only for
      // marketing entrances.
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
    },
  },
  plugins: [],
};
