import type { LoaderFunctionArgs } from '@remix-run/node';
import { authenticator } from '~/modules/auth.google.server';
import { getVisitorCookieURL } from '~/modules/visitor.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const visitorRedirectUrl = await getVisitorCookieURL(request);
  return authenticator.authenticate('google', request, {
    successRedirect: `${visitorRedirectUrl ?? '/'}?loginSuccess=true`,
    failureRedirect: '/login',
  });
};
