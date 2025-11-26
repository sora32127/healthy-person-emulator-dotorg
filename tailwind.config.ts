import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.tsx'],
  theme: {
    fontFamily: {
      'noto-sans': ['Noto Sans JP'],
    },
    extend: {
      keyframes: {
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
        voteSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        spin: 'spin 1s linear',
        like: 'like 1s ease-in-out',
        dislike: 'dislike 1s ease-in-out',
        voteSpin: 'voteSpin 0.5s ease-in-out',
      },
    },
    fontSize: {
      '4xl': '32px',
      '3xl': '28px',
      '2xl': '24px',
      xl: '20px',
      lg: '16px',
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          ...require('daisyui/src/theming/themes').light,
          primary: '#99D9EA',
          secondary: '#264AF4',
          tertiary: '#00118F',
          info: '#00118F',
          error: '#B91C1C',
          'base-100': '#f5f5f5',
          'base-200': '#e5e5e5',
          'base-300': '#d4d4d4',
        },
      },
      {
        dark: {
          ...require('daisyui/src/theming/themes').dark,
          primary: '#99D9EA',
          secondary: '#264AF4',
          tertiary: '#00118F',
          'base-100': '#0F0F0F',
        },
      },
    ],
  },
} satisfies Config;
