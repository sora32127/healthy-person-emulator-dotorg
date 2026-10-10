import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

export function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/search?tags=${encodeURIComponent(params.tagName ?? '')}`);
}
