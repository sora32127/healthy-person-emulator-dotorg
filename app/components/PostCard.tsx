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

    const Tags = ["タグ1", "タグ2", "タグ3"];
    const dummyLikes = 10;
    const dummyDislikes = 2;

    return (
        <div className="bg-white shadow-md rounded-md p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
                <p className="text-gray-600 text-sm">{formattedPostDate}</p>
            </div>
            <NavLink to={postUrl} className="text-lg font-bold text-blue-600 hover:underline">{postTitle}</NavLink>
            <div className="mt-2">
                {Tags.map((tag, index) => (
                    <span key={index} className="inline-block py-1 text-sm font-semibold text-gray-500 mr-2 underline underline-offset-3">
                        {tag}
                    </span>
                ))}
            </div>
            <div className="flex items-center mt-2">
                <div className="flex items-center mr-4">
                    <img src="/thumb_up.svg" alt="Thumb up" className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-gray-600 ml-1">{dummyLikes}</span>
                </div>
                <div className="flex items-center">
                    <img src="/thumb_down.svg" alt="Thumb down" className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-gray-600 ml-1">{dummyDislikes}</span>
                </div>
            </div>
        </div>
    );
}