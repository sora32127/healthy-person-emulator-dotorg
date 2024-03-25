import { NavLink } from "@remix-run/react";

interface PostCardProps {
    postTitle: string;
    postDateJst: string;
    postUrl: string;
}

export default function PostCard({ postTitle, postDateJst, postUrl }: PostCardProps) {
    const formattedPostDate = new Date(postDateJst).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).replace(/\//g, "-");

    return (
        <div>
            <p>{formattedPostDate}</p>
            <NavLink to={postUrl}>{postTitle}</NavLink>
        </div>
    );
}
