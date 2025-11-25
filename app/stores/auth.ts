import { atom } from 'jotai';
import { z } from 'zod';

const authStateSchema = z.object({
  isSignedIn: z.boolean(),
  userUuid: z.string().nullable(),
  email: z.string().nullable(),
  userAuthType: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

type AuthState = z.infer<typeof authStateSchema>;

const initialAuthState: AuthState = {
  isSignedIn: false,
  userUuid: null,
  email: null,
  userAuthType: null,
  photoUrl: null,
};

export const authStateAtom = atom<AuthState>(initialAuthState);

export const getAuthStateAtom = atom((get) => get(authStateAtom));

export const isSignedInAtom = atom((get) => get(authStateAtom).isSignedIn);

export const setAuthStateAtom = atom(null, (get, set, authState: AuthState) => {
  set(authStateAtom, authState);
});
