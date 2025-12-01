import { useLoaderData, useSubmit, Link, useLocation } from '@remix-run/react';
import { H1 } from '~/components/Headings';
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { getFeedPosts } from '~/modules/db.server';
import PostSection from '~/components/PostSection';
import { commonMetaFunction } from '~/utils/commonMetafunction';
import { Rss } from 'lucide-react';

type FeedPostType = 'unboundedLikes' | 'timeDesc' | 'likes' | 'timeAsc';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pagingNumber = Number.parseInt(url.searchParams.get('p') || '1');
  const likeFromHour = Number.parseInt(
    url.searchParams.get('likeFrom') || '48',
  );
  const likeToHour = Number.parseInt(url.searchParams.get('likeTo') || '0');
  const type =
    url.searchParams.get('type') || ('unboundedLikes' as FeedPostType);
  const chunkSize = 12;
  const postData = await getFeedPosts(
    pagingNumber,
    type as FeedPostType,
    chunkSize,
    likeFromHour,
    likeToHour,
  );
  return postData;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action');

  // フィードページ内部でのアクションはタイプ変更かページネーションのみ

  if (action === 'feedTypeChange') {
    const type = formData.get('type') as FeedPostType;
    const pagingNumber = 1;
    return redirect(`/feed?p=${pagingNumber}&type=${type}`);
  }
  const url = new URL(request.url);
  const currentPage = Number.parseInt(
    (formData.get('currentPage') as string) || '1',
  );
  const likeFrom = url.searchParams.get('likeFrom') || '';
  const likeTo = url.searchParams.get('likeTo') || '';
  const type = url.searchParams.get('type');

  if (action === 'firstPage') {
    return redirect(
      `/feed?p=1&type=${type}${likeFrom ? `&likeFrom=${likeFrom}` : ''}${likeTo ? `&likeTo=${likeTo}` : ''}`,
    );
  }

  if (action === 'prevPage') {
    return redirect(
      `/feed?p=${currentPage - 1}&type=${type}${likeFrom ? `&likeFrom=${likeFrom}` : ''}${likeTo ? `&likeTo=${likeTo}` : ''}`,
    );
  }

  if (action === 'nextPage') {
    return redirect(
      `/feed?p=${currentPage + 1}&type=${type}${likeFrom ? `&likeFrom=${likeFrom}` : ''}${likeTo ? `&likeTo=${likeTo}` : ''}`,
    );
  }

  if (action === 'lastPage') {
    const totalCount = Number.parseInt(formData.get('totalCount') as string);
    const chunkSize = Number.parseInt(formData.get('chunkSize') as string);
    const lastPageNumber = Math.ceil(totalCount / chunkSize);
    return redirect(
      `/feed?p=${lastPageNumber}&type=${type}${likeFrom ? `&likeFrom=${likeFrom}` : ''}${likeTo ? `&likeTo=${likeTo}` : ''}`,
    );
  }
  return null;
}

export default function Feed() {
  const postData = useLoaderData<typeof loader>();
  const chunkSize = postData.meta.chunkSize;
  const totalPages = Math.ceil(postData.meta.totalCount / chunkSize);
  const type = postData.meta.type;
  const submit = useSubmit();
  const currentPage = postData.meta.currentPage;

  const handleFeedTypeChange = (orderby: string) => {
    const formData = new FormData();
    formData.append('action', 'feedTypeChange');
    formData.append('type', orderby);
    submit(formData, { method: 'post' });
  };

  const handlePageChange = (action: string) => {
    const formData = new FormData();
    formData.append('action', action);
    formData.append('currentPage', currentPage.toString());
    formData.append('totalCount', postData.meta.totalCount.toString());
    formData.append('chunkSize', chunkSize.toString());
    formData.append('type', type);
    submit(formData, { method: 'post' });
  };

  const location = useLocation();

  return (
    <div>
      <H1>フィード</H1>
      <div className="feed-type-select flex items-center">
        <select
          onChange={(e) => handleFeedTypeChange(e.target.value)}
          className="select select-bordered select-sm"
          value={type}
        >
          <option
            value="unboundedLikes"
            className="select-option"
          >
            無期限いいね順
          </option>
          <option
            value="timeDesc"
            className="select-option"
          >
            新着順
          </option>
          <option
            value="likes"
            className="select-option"
          >
            いいね順
          </option>
          <option
            value="timeAsc"
            className="select-option"
          >
            古い順
          </option>
        </select>
        <Link
          to={`/feed.xml?${new URLSearchParams(location.search).toString()}`}
          reloadDocument
        >
          <button type="button" className="btn btn-ghost h-9 w-9 p-0 ml-2">
            <Rss className="fill-none stroke-current" />
          </button>
        </Link>
      </div>
      <div className="feed-posts">
        <PostSection posts={postData.result} title="" identifier="" />
      </div>
      <div className="search-navigation flex justify-center my-4">
        {totalPages >= 1 && (
          <div className="join">
            <button
              className="join-item btn btn-lg"
              onClick={() => handlePageChange('firstPage')}
              disabled={currentPage === 1}
              type="submit"
            >
              «
            </button>
            <button
              className="join-item btn btn-lg"
              onClick={() => handlePageChange('prevPage')}
              disabled={currentPage === 1}
              type="submit"
            >
              ‹
            </button>
            <div className="join-item bg-base-200 font-bold text-lg flex items-center justify-center min-w-[100px]">
              {currentPage} / {totalPages}
            </div>
            <button
              className="join-item btn btn-lg"
              onClick={() => handlePageChange('nextPage')}
              disabled={currentPage === totalPages}
              type="submit"
            >
              ›
            </button>
            <button
              className="join-item btn btn-lg"
              onClick={() => handlePageChange('lastPage')}
              disabled={currentPage === totalPages}
              type="submit"
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: 'Loading...' }];
  }
  const { type, currentPage, likeFromHour, likeToHour } = data.meta;

  const title = `フィード : ${
    type === 'unboundedLikes'
      ? `無期限いいね順 ページ：${currentPage}`
      : type === 'timeDesc'
        ? `新着順 ページ：${currentPage}`
        : type === 'timeAsc'
          ? `古い順 ページ：${currentPage}`
          : type === 'likes'
            ? `いいね順 ページ：${currentPage} ${likeFromHour ? `(${likeFromHour}時間前 〜 ${likeToHour}時間前)` : ''}`
            : `古い順 ${currentPage} ページ`
  }`;

  const commonMeta = commonMetaFunction({
    title,
    description: 'フィード',
    url: `https://healthy-person-emulator.org/feed?p=${currentPage}&type=${type}${likeFromHour ? `&likeFromHour=${likeFromHour}` : ''}${likeToHour ? `&likeToHour=${likeToHour}` : ''}`,
    image:
      'https://qc5axegmnv2rtzzi.public.blob.vercel-storage.com/favicon-CvNSnEUuNa4esEDkKMIefPO7B1pnip.png',
  });
  return commonMeta;
};
