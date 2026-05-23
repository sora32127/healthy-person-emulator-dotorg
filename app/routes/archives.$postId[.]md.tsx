import type { LoaderFunctionArgs } from 'react-router';
import { ArchiveDataEntry } from '~/modules/db.server';
import { markdownResponse, renderArticleMarkdown } from '~/modules/markdown.server';

export async function loader({ params }: LoaderFunctionArgs) {
  const postId = Number(params.postId);
  if (!Number.isFinite(postId) || postId <= 0) {
    return new Response('Not Found', { status: 404 });
  }
  const data = await ArchiveDataEntry.getData(postId);
  return markdownResponse(renderArticleMarkdown(data));
}
