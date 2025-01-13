import { type MetaFunction, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { CommonNavLink } from "~/components/CommonNavLink";
import { authenticator } from "~/modules/auth.google.server";
import { getBookmarkPosts, getUserId, PostCardData } from "~/modules/db.server";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { ThumbsUp, ThumbsDown, MessageSquareText } from 'lucide-react';

export async function loader({ request }: LoaderFunctionArgs){
    const isAuthenticated = await authenticator.isAuthenticated(request);
    if (!isAuthenticated){
        return redirect("/?referrer=fromBookmark");
    }
    const userId = await getUserId(isAuthenticated.userUuid);
    const bookmarkPosts = await getBookmarkPosts(userId);
    return { bookmarkPosts, email: isAuthenticated.email };
}

export default function BookmarkLayout(){
    const { bookmarkPosts, email } = useLoaderData<typeof loader>();
    return (
        <div>
            <h1>ブックマーク</h1>
            <p>ブックマークした記事</p>
            <p>メールアドレス: {email}</p>
            <p>ブックマーク数: {bookmarkPosts.length}</p>
            <BookMarkView bookmarkPosts={bookmarkPosts} />
        </div>
    )
}

function BookMarkView({ bookmarkPosts }: { bookmarkPosts: PostCardData[] }){
    return (
        <ul>
            {bookmarkPosts.map((post) => (
                <li key={post.postId} className="flex gap-x-3 my-2">
                    <CommonNavLink to={`/archives/${post.postId}`}>{post.postTitle}</CommonNavLink>
                    <div className="flex items-center gap-x-1">
                        <ThumbsUp className="fill-none stroke-current gap-x-1" /> {post.countLikes}
                        <ThumbsDown className="fill-none stroke-current gap-x-1" /> {post.countDislikes}
                        <MessageSquareText className="fill-none stroke-current gap-x-1" /> {post.countComments}
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
  

