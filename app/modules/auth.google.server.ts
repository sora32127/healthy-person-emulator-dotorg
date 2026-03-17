import { Authenticator } from 'remix-auth';
import { OAuth2Strategy } from 'remix-auth-oauth2';
import {
  sessionStorage,
  getSession,
  commitSession,
  destroySession,
} from './session.server';
import { findUserByEmail, createGoogleUser } from './db.server';
import { z } from 'zod';
import { redirect } from 'react-router';

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

const SESSION_KEY = 'user';

export const authenticator = new Authenticator<ExposedUser>();

/**
 * セッションから認証済みユーザーを取得する（remix-auth v4 では isAuthenticated が廃止されたため）
 */
export async function getAuthenticatedUser(
  request: Request,
): Promise<ExposedUser | null> {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get(SESSION_KEY) as ExposedUser | undefined;
  return user ?? null;
}

/**
 * 認証済みユーザーをセッションに保存する
 */
export async function setAuthenticatedUser(
  request: Request,
  user: ExposedUser,
): Promise<Headers> {
  const session = await getSession(request.headers.get('Cookie'));
  session.set(SESSION_KEY, user);
  const headers = new Headers();
  headers.append('Set-Cookie', await commitSession(session));
  return headers;
}

/**
 * ログアウト処理（セッション破棄 + リダイレクト）
 */
export async function logoutUser(
  request: Request,
  redirectTo: string,
  extraHeaders?: Headers,
): Promise<never> {
  const session = await getSession(request.headers.get('Cookie'));
  const headers = new Headers(extraHeaders);
  headers.append('Set-Cookie', await destroySession(session));
  throw redirect(redirectTo, { headers });
}

/**
 * デモ用のGoogle認証ストラテジー
 */
class MockGoogleStrategy extends OAuth2Strategy<ExposedUser> {
  constructor() {
    super(
      {
        clientId: 'mock',
        clientSecret: 'mock',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        redirectURI: `${process.env.CLIENT_URL}/auth/google/callback`,
        scopes: ['openid', 'email', 'profile'],
      },
      async () => {
        return await this.getExposedUserByEmail(this.demoEmail);
      },
    );
  }

  name = 'google';
  private demoEmail = 'demo@example.com';

  async authenticate(request: Request): Promise<ExposedUser> {
    const url = new URL(request.url);

    if (url.pathname.includes('/auth/google/callback')) {
      return await this.getExposedUserByEmail(this.demoEmail);
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
const googleStrategy = new OAuth2Strategy<ExposedUser>(
  {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    redirectURI: `${process.env.CLIENT_URL}/auth/google/callback`,
    scopes: ['openid', 'email', 'profile'],
  },
  async ({ tokens }) => {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      },
    );
    const profile = (await response.json()) as {
      email: string;
      picture?: string;
    };
    const email = profile.email;

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
      photoUrl: profile.picture,
    };
  },
);

if (process.env.GOOGLE_CLIENT_ID === 'google-client-demo-id') {
  authenticator.use(new MockGoogleStrategy(), 'google');
} else {
  authenticator.use(googleStrategy, 'google');
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
