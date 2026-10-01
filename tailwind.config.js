/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#05030a",
          800: "#0a0713",
          700: "#120d1f",
          600: "#1b1430",
        },
        ember: {
          300: "#ffc48a",
          400: "#ff9d4d",
          500: "#ff7a3d",
          600: "#f2542d",
        },
        aqua: {
          300: "#8ff5e6",
          400: "#47e0c8",
          500: "#1fc2ab",
        },
        rose: {
          400: "#f0679f",
          500: "#d94b84",
        },
        bone: {
          100: "#f7f1e6",
          300: "#d9cfc0",
          500: "#9b8f80",
        },
      },
      fontFamily: {
        display: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        deck: "0 40px 80px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)",
        glow: "0 0 40px -8px var(--tw-shadow-color)",
      },
      keyframes: {
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(4%,-6%,0) scale(1.18)" },
        },
        spinSlow: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        flicker: {
          "0%,100%": { opacity: "0.55" },
          "8%": { opacity: "0.62" },
          "12%": { opacity: "0.5" },
          "60%": { opacity: "0.6" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        drift: "drift 18s ease-in-out infinite",
        "drift-slow": "drift 34s ease-in-out infinite reverse",
        "spin-slow": "spinSlow 26s linear infinite",
        flicker: "flicker 7s linear infinite",
        marquee: "marquee 18s linear infinite",
      },
    },
  },
  plugins: [],
};
