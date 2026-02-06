/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#fbf8f4",
          100: "#f4efe7",
          200: "#e7ddcf",
          300: "#d5c5b1",
          400: "#b8a189",
          500: "#9a7b63",
          600: "#7c5e4b",
          700: "#614838",
          800: "#443329",
          900: "#2b211b"
        },
        clay: {
          100: "#f1ece7",
          300: "#d8c7bb",
          500: "#b59686",
          700: "#8b6d60",
          900: "#5a453c"
        },
        gold: {
          100: "#fff1d7",
          200: "#ffe2be",
          300: "#ffd49b",
          500: "#f4a145",
          700: "#d57f1f",
          900: "#9a5a12"
        },
        ink: {
          100: "#f5f6f7",
          200: "#e3e6ea",
          300: "#d1d5db",
          400: "#a6abb4",
          500: "#8b9099",
          600: "#6b717a",
          700: "#4b515a",
          800: "#323842",
          900: "#1f2328"
        },
        sage: {
          100: "#ebf4ef",
          300: "#c7e2d4",
          500: "#8ab9a1",
          700: "#5f8f7a",
          900: "#365c4b"
        }
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "sans-serif"],
        serif: ["'Playfair Display'", "serif"]
      },
      borderRadius: {
        xl: "1rem",
        '2xl': "1.5rem",
        '3xl': "1.75rem"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(31, 35, 40, 0.12)",
        card: "0 16px 36px rgba(31, 35, 40, 0.12)",
        glow: "0 0 0 1px rgba(255, 255, 255, 0.7), 0 16px 40px rgba(31, 35, 40, 0.1)"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        },
        fadeSoft: {
          "0%": { opacity: 0, transform: "translateY(18px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        fadeUp: "fadeUp 0.6s ease-out",
        fadeSoft: "fadeSoft 0.8s ease-out",
        floaty: "floaty 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};



