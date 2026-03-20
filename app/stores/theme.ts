import { atom } from 'jotai';

function getThemeFromCookie(): string {
  if (typeof document === 'undefined') return 'light';
  const match = document.cookie.match(/(?:^|; )theme=([^;]*)/);
  return match?.[1] === 'dark' ? 'dark' : 'light';
}

const themeAtom = atom(getThemeFromCookie());

export const getThemeAtom = atom((get) => get(themeAtom));

export const toggleThemeAtom = atom(null, (get, set) => {
  const newTheme = get(themeAtom) === 'light' ? 'dark' : 'light';
  set(themeAtom, newTheme);
  document.querySelector('html')?.setAttribute('data-theme', newTheme);
  document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
});
