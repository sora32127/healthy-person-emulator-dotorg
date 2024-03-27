import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { prisma } from "~/modules/db.server";

export async function loader({ request }:LoaderFunctionArgs){
    const url = new URL(request.url);
    // Wordpress時代のURLと合わせるため、以下の形式のURLを想定する
    // https://healthy-person-emulator.org/archives/${postId}?q...
    const postId = url.pathname.split("/")[2];
    const postContent = await prisma.userPostContent.findFirst({
        where: {
          postId: Number(postId),
        },
        orderBy: {
          postRevisionNumber: 'desc',
        },
      });
    
    const tagNames = await prisma.dimTags.findMany({
        select: {
          tagName: true,
        },
        where: {
          postId: Number(postId),
        },
    });

    return json({ postContent, tagNames });
}

export default function Component() {
    const { postContent, tagNames } = useLoaderData<typeof loader>();
    return (
        <div>
            <h1>{postContent.postTitle}</h1>
            <div>
                {tagNames.map((tag) => (
                    <span key={tag.tagName}>{tag.tagName}</span>
                ))}
            </div>
            <div dangerouslySetInnerHTML={{ __html: postContent.postContent }} />
        </div>
    );

}