import type { LoaderFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/modules/auth.google.server'

export const loader = ({ request }: LoaderFunctionArgs) => {
  return authenticator.authenticate('google', request, {
    successRedirect: '/',
    failureRedirect: '/login',
  })
}
