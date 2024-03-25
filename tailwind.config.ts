import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.tsx'],
  theme: {
    extend: {},
    fontSize: {
      "4xl" : "32px",
      "3xl" : "28px",
      "2xl" : "24px",
      "xl" : "20px",
      "lg" : "16px",
    }
  },
  plugins: [],
} satisfies Config

