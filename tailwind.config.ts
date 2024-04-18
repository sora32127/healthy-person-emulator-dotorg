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
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          ...require("daisyui/src/theming/themes")["light"],
          primary: "#0017C1",
          secondary: "#264AF4",
          tertiary: "#00118F",
        },
      },
      {
        dark: {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          ...require("daisyui/src/theming/themes")["dark"],
          primary: "#0017C1",
          secondary: "#264AF4",
          tertiary: "#00118F",
        },
      },
    ],
  }
} satisfies Config

