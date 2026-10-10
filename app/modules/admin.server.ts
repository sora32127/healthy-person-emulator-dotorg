import { redirect } from 'react-router';
import { getAuthenticatedUser } from './auth.google.server';

export function isAdminUser(user: { email: string } | null): boolean {
  if (!user) return false;
  const env = (globalThis as any).__cloudflareEnv;
  const adminEmails = (env?.ADMIN_EMAILS || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  return adminEmails.includes(user.email);
}

export async function requireAdmin(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || !isAdminUser(user)) throw redirect('/');

  return user;
}
