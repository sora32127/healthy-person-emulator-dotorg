import { atom } from "jotai";
import { z } from "zod";

const authStateSchema = z.object({
  isSignedIn: z.boolean(),
  userId: z.string().nullable(),
  email: z.string().nullable(),
  userName: z.string().nullable(),
});

type AuthState = z.infer<typeof authStateSchema>;

const initialAuthState: AuthState = {
  isSignedIn: false,
  userId: null,
  email: null,
  userName: null,
};

export const authStateAtom = atom<AuthState>(initialAuthState);

export const isSignedInAtom = atom((get) => get(authStateAtom).isSignedIn);

export const setAuthStateAtom = atom(null, (get, set, authState: AuthState) => {
  set(authStateAtom, authState);
});