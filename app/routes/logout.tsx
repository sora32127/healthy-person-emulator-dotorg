import type { LoaderFunctionArgs } from 'react-router';
import { logoutUser } from '~/modules/auth.google.server';
import { destroyVisitorCookie } from '~/modules/visitor.server';
import { suppressGoogleIdentityAutoSelect } from '~/modules/google-identity.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = await destroyVisitorCookie(request);
  await suppressGoogleIdentityAutoSelect(headers);
  return logoutUser(request, '/', headers);
}
