import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const tagName = url.pathname.split('/')[2];
  return redirect(`/search?tags=${tagName}`);
}
