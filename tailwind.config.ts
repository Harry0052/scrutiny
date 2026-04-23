import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        civic: {
          50: "#eef8ff",
          100: "#d9eeff",
          200: "#addcff",
          300: "#76c4ff",
          400: "#3ea3ff",
          500: "#147ddf",
          600: "#0f62b7",
          700: "#114d8f",
          800: "#123f73",
          900: "#13355e",
          950: "#0b223f"
        },
        slatebase: {
          950: "#070a11"
        }
      },
      boxShadow: {
        panel: "0 20px 60px -30px rgba(8, 18, 40, 0.75)",
        insetsoft: "inset 0 1px 0 rgba(255, 255, 255, 0.08)"
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
