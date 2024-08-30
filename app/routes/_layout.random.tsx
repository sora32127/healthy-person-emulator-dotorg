import type { MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import CommentShowCard from "~/components/CommentShowCard";
import { H1 } from "~/components/Headings";
import PostCard from "~/components/PostCard";
import { getRandomComments, getRandomPosts } from "~/modules/db.server";

export async function loader(){
    const randomPosts = await getRandomPosts();
    const randomComments = await getRandomComments();

    return { randomPosts, randomComments }
}

export default function Random() {
    const { randomPosts, randomComments } = useLoaderData<typeof loader>();
    return (
        <div>
            <div className="random-posts">
                <H1>ランダム記事</H1>
                {randomPosts.map((post) => (
                    <PostCard
                        key={post.postId}
                        postId={post.postId}
                        postTitle={post.postTitle}
                        postDateGmt={post.postDateGmt}
                        tagNames={post.tags.map((tag) => tag.tagName)}
                        countLikes={post.countLikes}
                        countDislikes={post.countDislikes}
                        countComments={post.countComments}
                    />
                ))}
            </div>
            <div className="random-comments">
                <H1>ランダムコメント</H1>
                {randomComments.map((comment) => (
                    <CommentShowCard
                        key={comment.commentId}
                        commentContent={comment.commentContent}
                        commentDateGmt={comment.commentDateGmt}
                        commentAuthor={comment.commentAuthor}
                        postId={comment.postId}
                        dimPosts={comment.dimPosts}
                    />
                ))}
                </div>
        </div>
    );
}

export const meta: MetaFunction = () => {
    const title = "ランダム記事・コメント";
    const description = "ランダムな出会いを楽しもう";
    const ogLocale = "ja_JP";
    const ogSiteName = "健常者エミュレータ事例集";
    const ogType = "article";
    const ogTitle = title;
    const ogDescription = description;
    const ogUrl = "https://healthy-person-emulator.org/random";
    const twitterCard = "summary"
    const twitterSite = "@helthypersonemu"
    const twitterTitle = title
    const twitterDescription = description
    const twitterCreator = "@helthypersonemu"
    const twitterImage = "https://qc5axegmnv2rtzzi.public.blob.vercel-storage.com/favicon-CvNSnEUuNa4esEDkKMIefPO7B1pnip.png"
  
    return [
      { title },
      { description },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: ogDescription },
      { property: "og:locale", content: ogLocale },
      { property: "og:site_name", content: ogSiteName },
      { property: "og:type", content: ogType },
      { property: "og:url", content: ogUrl },
      { name: "twitter:card", content: twitterCard },
      { name: "twitter:site", content: twitterSite },
      { name: "twitter:title", content: twitterTitle },
      { name: "twitter:description", content: twitterDescription },
      { name: "twitter:creator", content: twitterCreator },
      { name: "twitter:image", content: twitterImage },
    ];
  };
  