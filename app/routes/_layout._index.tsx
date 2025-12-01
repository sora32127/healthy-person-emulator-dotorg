import { NavLink, useLoaderData } from '@remix-run/react';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  getFeedComments,
  getFeedPosts,
  getRandomComments,
  getRandomPosts,
  getRecentPostsByTagId,
} from '~/modules/db.server';
import ReloadButton from '~/components/ReloadButton';
import PostSection from '~/components/PostSection';
import CommentSection from '~/components/CommentSection';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export const meta: MetaFunction = () => {
  const commonMeta = commonMetaFunction({
    title: 'トップページ',
    description: '現実世界のために',
    url: 'https://healthy-person-emulator.org',
    image: null,
  });
  return commonMeta;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') || 'trend';
  const mostRecentPosts = await getFeedPosts(1, 'timeDesc', 12);
  const recentVotedPosts = await getFeedPosts(1, 'likes', 12, 24, 0);
  const communityPosts = await getRecentPostsByTagId(986);
  const famedPosts = await getRecentPostsByTagId(575);
  const mostRecentComments = await getFeedComments(1, 'timeDesc');
  const randomPosts = await getRandomPosts();
  const randomComments = await getRandomComments();
  return {
    tab,
    mostRecentPosts,
    recentVotedPosts,
    communityPosts,
    famedPosts,
    mostRecentComments,
    randomPosts,
    randomComments,
  };
}

export default function Feed() {
  const {
    tab,
    mostRecentPosts,
    recentVotedPosts,
    communityPosts,
    famedPosts,
    mostRecentComments,
    randomPosts,
    randomComments,
  } = useLoaderData<typeof loader>();
  return (
    <div>
      <div>
        <div
          role="tabpanel"
          className="tab-content"
          style={{ display: tab === 'trend' ? 'block' : 'none' }}
        >
          <PostSection
            title="最新の投稿"
            posts={mostRecentPosts.result}
            identifier="latest"
          >
            <button
              className="rounded-md block w-full max-w-[800px] px-10 py-2 text-center my-4 bg-base-200 hover:bg-base-300 mx-auto"
              type="button"
            >
              <NavLink
                to="/feed?p=2&type=timeDesc"
                className="block w-full h-full"
              >
                最新の投稿を見る
              </NavLink>
            </button>
          </PostSection>
          <PostSection
            title="最近いいねされた投稿"
            posts={recentVotedPosts.result}
            identifier="voted"
          >
            <button
              className="rounded-md block w-full max-w-[400px] px-4 py-2 text-center my-4 bg-base-200 mx-auto hover:bg-base-300"
              type="button"
            >
              <NavLink
                to="/feed?p=2&likeFrom=48&likeTo=0&type=likes"
                className="block w-full h-full"
              >
                最近いいねされた投稿を見る
              </NavLink>
            </button>
          </PostSection>
          <CommentSection
            title="最近のコメント"
            comments={mostRecentComments.result}
          >
            <button
              className="rounded-md block w-full max-w-[400px] px-4 py-2 text-center my-4 bg-base-200 mx-auto hover:bg-base-300"
              type="button"
            >
              <NavLink
                to="/comment?p=2&type=timeDesc"
                className="block w-full h-full"
              >
                最近のコメントを見る
              </NavLink>
            </button>
          </CommentSection>
        </div>
        <div
          role="tabpanel"
          className="tab-content"
          style={{ display: tab === 'fixed' ? 'block' : 'none' }}
        >
          <PostSection title="殿堂入り" posts={famedPosts} identifier="famed" />
          <PostSection
            title="コミュニティ選"
            posts={communityPosts}
            identifier="community"
          />
        </div>
        <div
          role="tabpanel"
          className="tab-content"
          style={{ display: tab === 'random' ? 'block' : 'none' }}
        >
          <PostSection title="ランダム投稿" posts={randomPosts} identifier="random">
            <div className="flex justify-center">
              <ReloadButton />
            </div>
          </PostSection>
          <CommentSection title="ランダムコメント" comments={randomComments}>
            <div className="flex justify-center">
              <ReloadButton />
            </div>
          </CommentSection>
        </div>
      </div>
    </div>
  );
}
