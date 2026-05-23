import { getFeedPosts } from '~/modules/db.server';
import { markdownResponse, renderHomeMarkdown } from '~/modules/markdown.server';

export async function loader() {
  const latest = await getFeedPosts(1, 'timeDesc', 12);
  const voted = await getFeedPosts(1, 'likes', 12, 24, 0);
  return markdownResponse(
    renderHomeMarkdown({
      latest: latest.result,
      voted: voted.result,
    }),
  );
}
