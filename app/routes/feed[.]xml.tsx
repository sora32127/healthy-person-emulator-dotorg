import type { LoaderFunctionArgs } from '@remix-run/node';
import { getFeedPosts } from '~/modules/db.server';
import { type Category, Feed } from 'feed';

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

  const baseUrl = url.origin;
  const feedUrl = `${baseUrl}/feed.xml?p=${pagingNumber}&type=${type}${type === 'likes' ? `&likeFrom=${likeFromHour}&likeTo=${likeToHour}` : ''}`;

  const feed = new Feed({
    title: feedTitle,
    description: feedDescription,
    id: feedUrl,
    link: feedUrl,
    language: 'ja',
    favicon: `${baseUrl}/favicon.ico`,
    updated: new Date(),
    copyright: `© ${new Date().getFullYear()} All rights reserved.`,
    feedLinks: {
      rss: feedUrl,
    },
    author: {
      name: '健常者エミュレータ事例集',
      link: baseUrl,
    },
  });

  for (const post of postData.result) {
    const postUrl = `${baseUrl}/archives/${post.postId}`;
    const categories: Category[] = post.tags.map((tag) => ({
      name: tag.tagName,
      domain: `${baseUrl}/search?tags=${tag.tagName}`,
    }));

    feed.addItem({
      title: post.postTitle,
      description: `いいね: ${post.countLikes} | よくないね: ${post.countDislikes} | コメント: ${post.countComments}`,
      id: postUrl,
      link: postUrl,
      category: categories,
      date: post.postDateGmt,
      image: post.ogpImageUrl ?? undefined,
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
