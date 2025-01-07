import type { LoaderFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/modules/auth.google.server'
import { getVisitorCookieData } from '~/modules/visitor.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const visitorCookieData = await getVisitorCookieData(request);
  const visitorRedirectUrl = visitorCookieData.redirectUrl;
  return authenticator.authenticate('google', request, {
    successRedirect: `${visitorRedirectUrl ?? '/'}?loginSuccess=true`,
    failureRedirect: '/login',
  })
}
