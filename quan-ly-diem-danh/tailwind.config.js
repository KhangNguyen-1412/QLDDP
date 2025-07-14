/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // THÊM HOẶC CẬP NHẬT DÒNG NÀY
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}