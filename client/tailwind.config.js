/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        xs: "475px",
        "3xl": "1920px",
        "4xl": "2560px",
        "5xl": "3200px",
        "6xl": "3840px",
        "7xl": "5120px",
      },
    },
  },
  plugins: [],
};