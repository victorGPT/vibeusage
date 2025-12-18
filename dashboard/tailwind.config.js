/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "matrix-bg": "#050505",
        "matrix-green": "#00FF41",
        "matrix-panel": "rgba(0, 0, 0, 0.8)",
      },
      fontFamily: {
        mono: ["Share Tech Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
