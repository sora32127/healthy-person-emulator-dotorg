import { Authenticator } from "remix-auth";
import { GoogleStrategy, type GoogleProfile } from "remix-auth-google";
import { sessionStorage } from "./session.server";
import { findUserByEmail, createGoogleUser } from "./db.server";
import { z } from "zod";
/*
ブラウザ側に露出しうるユーザーのデータのスキーマ
*/
export const exposedUserSchema = z.object({
  userUuid: z.string(),
  email: z.string(),
  userAuthType: z.enum(["Email", "Google"]),
  photoUrl: z.string().optional()
});

export type ExposedUser = z.infer<typeof exposedUserSchema>;

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.CLIENT_URL) {
  throw new Error("Missing environment variables");
}

const SESSION_SECRET = process.env.HPE_SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("Missing SESSION_SECRET environment variable");
}

export const authenticator = new Authenticator<ExposedUser>(sessionStorage);

const googleStrategy = new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.CLIENT_URL}/auth/google/callback`,
},
  async ({ profile }: { profile: GoogleProfile }) => {
    const email = getUserEmail(profile);
    const isUserExists = await judgeIsUserExists(email);
    if (!isUserExists) {
      const user = await createUser(email);
      return {
        userUuid: user.userUuid,
        email: user.email,
        userAuthType: user.userAuthType,
      };
    }
    const user = await getUser(email);
    if (!user) {
      throw new Error("User not found");
    }
    return {
      userUuid: user.userUuid,
      email: user.email,
      userAuthType: user.userAuthType,
      photoUrl: profile.photos[0].value,
    };
  },
);


authenticator.use(googleStrategy, "google");

function getUserEmail(profile: GoogleProfile) {
  return profile.emails?.[0]?.value
}

async function judgeIsUserExists(email: string) {
  const user = await findUserByEmail(email);
  return user !== null;
}

async function createUser(email: string) {
  return createGoogleUser(email);
}

async function getUser(email: string) {
  return findUserByEmail(email);
}
