import type { LoaderFunctionArgs } from '@remix-run/node';
import { getFeedPosts } from '~/modules/db.server';
import RSS from 'rss';

type FeedPostType = 'unboundedLikes' | 'timeDesc' | 'likes' | 'timeAsc';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pagingNumber = Number.parseInt(url.searchParams.get('p') || '1');
  const likeFromHour = Number.parseInt(
    url.searchParams.get('likeFrom') || '48',
  );
  const likeToHour = Number.parseInt(url.searchParams.get('likeTo') || '0');
  const type = (url.searchParams.get('type') ||
    'unboundedLikes') as FeedPostType;
  const chunkSize = 12;

  const postData = await getFeedPosts(
    pagingNumber,
    type,
    chunkSize,
    likeFromHour,
    likeToHour,
  );

  const feedTitle =
    type === 'unboundedLikes'
      ? '健常者エミュレータ事例集 - 無期限いいね順'
      : type === 'timeDesc'
        ? '健常者エミュレータ事例集 - 新着順'
        : type === 'likes'
          ? '健常者エミュレータ事例集 - いいね順'
          : '健常者エミュレータ事例集 - 古い順';

  const feedDescription =
    type === 'unboundedLikes'
      ? '健常者エミュレータ事例集の投稿を無期限いいね順で配信'
      : type === 'timeDesc'
        ? '健常者エミュレータ事例集の新着投稿を配信'
        : type === 'likes'
          ? `健常者エミュレータ事例集の過去${likeFromHour}時間のいいね順投稿を配信`
          : '健常者エミュレータ事例集の投稿を古い順で配信';

  const baseUrl = 'https://healthy-person-emulator.org';
  const feedUrl = `${baseUrl}/feed.xml?p=${pagingNumber}&type=${type}${type === 'likes' ? `&likeFrom=${likeFromHour}&likeTo=${likeToHour}` : ''}`;

  const feed = new RSS({
    title: feedTitle,
    description: feedDescription,
    feed_url: feedUrl,
    site_url: baseUrl,
    language: 'ja',
    pubDate: new Date(),
  });

  for (const post of postData.result) {
    const postUrl = `${baseUrl}/archives/${post.postId}`;
    const categories = post.tags.map((tag) => tag.tagName);

    feed.item({
      title: post.postTitle,
      description: `いいね: ${post.countLikes} | よくないね: ${post.countDislikes} | コメント: ${post.countComments}`,
      url: postUrl,
      guid: postUrl,
      categories: categories,
      date: post.postDateGmt,
    });
  }

  const rssXml = feed.xml({ indent: true });

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
