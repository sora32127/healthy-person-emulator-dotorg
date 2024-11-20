import type { RecommendResult } from "~/modules/recommend.server";

import { NavLink } from "@remix-run/react";

export function RecommendedPosts({ recommendResult }: { recommendResult: RecommendResult }) {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">あなたにおすすめ</h2>
      
      <div className="overflow-x-auto">
        <div className="flex space-x-4 pb-4">
          {recommendResult.map((post) => (
            <NavLink 
              key={post.postId} 
              to={`/archives/${post.postId}`}
              aria-label={`記事「${post.postTitle}」を読む`}
              className="flex-shrink-0 w-64 rounded-lg p-4 bg-base-200
                transition-colors duration-200 ease-in-out
                hover:bg-base-300 focus:bg-base-300"
            >
              <h3 className="font-medium mb-2 line-clamp-2">{post.postTitle}</h3>
              <div className="text-sm text-gray-600">
                ♥ {post.countLikes}
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}