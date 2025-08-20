/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    theme: {
      container: {
        center: true,
      },

    },
    extend: {
      fontFamily: {
        'sans': ['"Segoe UI"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}  
