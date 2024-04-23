import { NavLink } from "@remix-run/react";
import parse from "html-react-parser";
import TagCard from "./TagCard";
import ArticleIcon from "./icons/ArticleIcon";
import TagIcon from "./icons/TagIcon";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";

interface PostCardProps {
    postId: number;
    postTitle: string;
    postDateGmt: string;
    tagNames: string[];
    countLikes: number;
    countDislikes: number;
    highLightedText?: string;
}

export default function PostCard({
    postId,
    postTitle,
    postDateGmt,
    tagNames,
    countLikes,
    countDislikes,
    highLightedText,
}: PostCardProps) {
    const formattedPostDate = new Date(postDateGmt).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).replace(/\//g, "-");

    tagNames.sort((a, b) => {
        if (a > b) {
            return 1;
        }
        if (a < b) {
            return -1;
        }
        return 0;
    });

    return (
        <div className="bg-base-100 border-2 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
                <p className="text-base-content text-sm post-timestamp">{formattedPostDate}</p>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2 mb-2 items-center">
                <ArticleIcon/>
                <NavLink to={`/archives/${postId}`} className="text-lg font-bold text-info underline underline-offset-4 post-title">{postTitle}</NavLink>
            </div>
            {highLightedText && (
                <p className="neutral-content">{parse(highLightedText)}</p>
            )}
            <div className="grid grid-cols-[auto_1fr] gap-2 mt-2 items-center">
                <TagIcon/>
                <div className="flex flex-wrap items-center">
                    {tagNames && tagNames.map((tag, index) => (
                        <span key={index} className="inline-block mr-1 mb-1">
                            <TagCard tagName={tag} />
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex items-center mt-2">
                <div className="flex items-center mr-4">
                    <ThumbsUpIcon/>
                    <span className="text-sm text-base-content ml-1">{countLikes}</span>
                </div>
                <div className="flex items-center">
                    <ThumbsDownIcon/>
                    <span className="text-sm text-base-content ml-1">{countDislikes}</span>
                </div>
            </div>
        </div>
    );
}