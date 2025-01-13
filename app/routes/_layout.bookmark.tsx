import { MetaFunction, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticator } from "~/modules/auth.google.server";
import { getBookmarkPosts, getUserId } from "~/modules/db.server";
import { commonMetaFunction } from "~/utils/commonMetafunction";

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
            <ul>
                {bookmarkPosts.map((post) => (
                    <li key={post.postId}>{post.postId}</li>
                ))}
            </ul>
        </div>
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
  

