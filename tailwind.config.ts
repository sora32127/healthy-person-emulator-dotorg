import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.tsx'],
  theme: {
    extend: {
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideOut: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        like: {
          '0%': { transform: 'scale(1)', color: 'inherit' },
          '50%': { transform: 'scale(1.5)', color: '#0000ff' },
          '100%': { transform: 'scale(1.2)', color: '#0000ff' },
        },
        dislike: {
          '0%': { transform: 'scale(1)', color: 'inherit' },
          '50%': { transform: 'scale(1.5)', color: '#ff0000' },
          '100%': { transform: 'scale(1.2)', color: '#ff0000' },
        },
      },
      animation: {
        slideIn: 'slideIn 0.3s ease-out',
        slideOut: 'slideOut 0.3s ease-in',
        spin: 'spin 1s linear',
        like: 'like 1s ease-in-out',
        dislike: 'dislike 1s ease-in-out',
      },
    },
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
          info: "#00118F",
          error: "#B91C1C"
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
