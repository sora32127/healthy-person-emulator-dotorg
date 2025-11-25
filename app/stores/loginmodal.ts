import { atom } from 'jotai';

const isLoginModalOpen = atom(false);

export const setIsLoginModalOpenAtom = atom(
  null,
  (get, set, value: boolean) => {
    set(isLoginModalOpen, value);
  },
);

export const getIsLoginModalOpenAtom = atom((get) => {
  return get(isLoginModalOpen);
});
