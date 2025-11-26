import { Authenticator, Strategy } from 'remix-auth';
import { GoogleStrategy, type GoogleProfile } from 'remix-auth-google';
import { sessionStorage } from './session.server';
import { findUserByEmail, createGoogleUser } from './db.server';
import { z } from 'zod';
import { redirect, type SessionStorage } from '@remix-run/node';
/**
 * ブラウザ側に露出しうるユーザーのデータのスキーマ
 */
const exposedUserSchema = z.object({
  userUuid: z.string(),
  email: z.string(),
  userAuthType: z.enum(['Email', 'Google']),
  photoUrl: z.string().optional(),
});

type ExposedUser = z.infer<typeof exposedUserSchema>;

if (
  !process.env.GOOGLE_CLIENT_ID ||
  !process.env.GOOGLE_CLIENT_SECRET ||
  !process.env.CLIENT_URL
) {
  throw new Error('Missing environment variables');
}

const SESSION_SECRET = process.env.HPE_SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error('Missing SESSION_SECRET environment variable');
}

export const authenticator = new Authenticator<ExposedUser>(sessionStorage);

/**
 * デモ用のGoogle認証ストラテジー
 */
class MockGoogleStrategy extends Strategy<ExposedUser, never> {
  name = 'google';
  private demoEmail = 'demo@example.com';

  constructor() {
    super(async () => await this.getExposedUserByEmail(this.demoEmail));
  }

  async authenticate(
    request: Request,
    sessionStorage: SessionStorage,
    options: any,
  ): Promise<ExposedUser> {
    const url = new URL(request.url);

    if (url.pathname.includes('/auth/google/callback')) {
      const exposedUser = await this.getExposedUserByEmail(this.demoEmail);
      return this.success(exposedUser, request, sessionStorage, options);
    }

    throw redirect(`${process.env.CLIENT_URL}/auth/google/callback`);
  }

  private async getExposedUserByEmail(email: string): Promise<ExposedUser> {
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
      throw new Error('User not found');
    }
    return {
      userUuid: user.userUuid,
      email: user.email,
      userAuthType: user.userAuthType,
    };
  }
}

/**
 * Google認証ストラテジー
 */
const googleStrategy = new GoogleStrategy(
  {
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
      throw new Error('User not found');
    }
    return {
      userUuid: user.userUuid,
      email: user.email,
      userAuthType: user.userAuthType,
      photoUrl: profile.photos[0].value,
    };
  },
);

if (process.env.GOOGLE_CLIENT_ID === 'google-client-demo-id') {
  authenticator.use(new MockGoogleStrategy(), 'google');
} else {
  authenticator.use(googleStrategy, 'google');
}

function getUserEmail(profile: GoogleProfile) {
  return profile.emails?.[0]?.value;
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
