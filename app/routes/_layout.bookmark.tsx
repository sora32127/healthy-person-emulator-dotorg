import { type MetaFunction, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { CommonNavLink } from "~/components/CommonNavLink";
import { authenticator } from "~/modules/auth.google.server";
import { getBookmarkPostsByPagenation, getUserId, type BookmarkPostCardData } from "~/modules/db.server";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { ThumbsUp, ThumbsDown, MessageSquareText } from 'lucide-react';
import { H1 } from "~/components/Headings";

export async function loader({ request }: LoaderFunctionArgs){
    const isAuthenticated = await authenticator.isAuthenticated(request);
    if (!isAuthenticated){
        return redirect("/?referrer=fromBookmark");
    }
    const userId = await getUserId(isAuthenticated.userUuid);
    const bookmarkPosts = await getBookmarkPostsByPagenation(userId, 1, 10);
    return { bookmarkPosts, email: isAuthenticated.email };
}

export default function BookmarkLayout(){
    const { bookmarkPosts, email } = useLoaderData<typeof loader>();
    return (
        <div>
            <H1>ブックマーク</H1>
            <BookMarkView bookmarkPosts={bookmarkPosts} />
        </div>
    )
}

function BookMarkView({ bookmarkPosts }: { bookmarkPosts: BookmarkPostCardData[] }){
    return (
        <ul className="space-y-4">
            {bookmarkPosts.map((post) => (
                <li key={post.postId} className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-y-1 sm:gap-x-3">
                            <time className="text-sm text-gray-500">
                                {post.bookmarkDateJST.toLocaleDateString()}
                            </time>
                            <CommonNavLink 
                                to={`/archives/${post.postId}`}
                                className="text-base sm:text-lg font-medium hover:text-blue-600"
                            >
                                {post.postTitle}
                            </CommonNavLink>
                        </div>
                        
                        <div className="flex items-center gap-x-4 text-sm text-gray-600">
                            <div className="flex items-center gap-x-1">
                                <ThumbsUp className="w-4 h-4 fill-none stroke-current" />
                                <span>{post.countLikes}</span>
                            </div>
                            <div className="flex items-center gap-x-1">
                                <ThumbsDown className="w-4 h-4 fill-none stroke-current" />
                                <span>{post.countDislikes}</span>
                            </div>
                            <div className="flex items-center gap-x-1">
                                <MessageSquareText className="w-4 h-4 fill-none stroke-current" />
                                <span>{post.countComments}</span>
                            </div>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    )
}


export const meta: MetaFunction<typeof loader> = ({ data }) => {
    if (!data){
      return [{ title: "Loading..." }];
    }
    const title = "ブックマーク";
    const description = "ブックマークした記事";
  
    const commonMeta = commonMetaFunction({
      title,
      description,
      image: null,
      url: "https://healthy-person-emulator.org/bookmark"
    });
  
    return commonMeta;
  };
  

