import type { LoaderFunctionArgs } from 'react-router';
import { logoutUser } from '~/modules/auth.google.server';
import { destroyVisitorCookie } from '~/modules/visitor.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = await destroyVisitorCookie(request);
  return logoutUser(request, '/', headers);
}
