import type { ActionFunctionArgs } from 'react-router';
import { authenticator } from '../modules/auth.google.server';

export async function action({ request }: ActionFunctionArgs) {
  return await authenticator.authenticate('google', request);
}
