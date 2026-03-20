import { redirect } from 'react-router';
import { getAuthenticatedUser } from './auth.google.server';

export async function requireAdmin(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) throw redirect('/');

  const env = (globalThis as any).__cloudflareEnv;
  const adminEmails = (env?.ADMIN_EMAILS || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (!adminEmails.includes(user.email)) throw redirect('/');

  return user;
}
