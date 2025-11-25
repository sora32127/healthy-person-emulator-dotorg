import { atom } from 'jotai';

export const themeAtom = atom('light');

export const getThemeAtom = atom((get) => get(themeAtom));

export const toggleThemeAtom = atom(null, (get, set) => {
  const newTheme = get(themeAtom) === 'light' ? 'dark' : 'light';
  set(themeAtom, newTheme);
  document.querySelector('html')?.setAttribute('data-theme', newTheme);
});
