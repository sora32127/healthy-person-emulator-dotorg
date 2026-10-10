import { isAdminUser } from './admin.server';

export function isLibraryEnabledForUser(user: { email: string } | null): boolean {
  return isAdminUser(user);
}
