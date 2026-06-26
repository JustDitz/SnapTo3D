import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dbe4ff",
          500: "#4c6ef5",
          600: "#3b5bdb",
          700: "#364fc7",
          900: "#1e3a8a",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
