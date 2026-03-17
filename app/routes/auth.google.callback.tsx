import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authenticator, setAuthenticatedUser } from '~/modules/auth.google.server';
import { getVisitorCookieURL } from '~/modules/visitor.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.authenticate('google', request);
  const visitorRedirectUrl = await getVisitorCookieURL(request);
  const headers = await setAuthenticatedUser(request, user);
  throw redirect(`${visitorRedirectUrl ?? '/'}?loginSuccess=true`, { headers });
};
