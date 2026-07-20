import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#bcdcff",
          300: "#8ec6ff",
          400: "#59a5ff",
          500: "#3382ff",
          600: "#1b61f5",
          700: "#144ce1",
          800: "#173eb6",
          900: "#19398f",
          950: "#142457",
        },
      },
    },
  },
  plugins: [],
};

export default config;
