import { NavLink } from "@remix-run/react";
import parse from "html-react-parser";
import TagCard from "./TagCard";
import articleIcon from "~/src/assets/article_icon.svg";
import tagIcon from "~/src/assets/tag_icon.svg";
import thumbUpIcon from "~/src/assets/thumb_up.svg";
import thumbDownIcon from "~/src/assets/thumb_down.svg";

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
        <div className="bg-base-200 border-2 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
                <p className="text-base-content text-sm post-timestamp">{formattedPostDate}</p>
            </div>
            <div className="flex items-center mb-2">
                <img src={articleIcon} alt="Article icon" className="h-5 w-5 mr-2" />
                <NavLink to={`/archives/${postId}`} className="text-xl font-bold text-info underline underline-offset-4 post-title">{postTitle}</NavLink>
            </div>
            {highLightedText && (
                <p className="neutral-content">{parse(highLightedText)}</p>
            )}
            <div className="mt-2 flex items-center">
                <img src={tagIcon} alt="Tag icon" className="h-5 w-5 mr-2" />
                <div className="flex flex-wrap">
                    {tagNames && tagNames.map((tag, index) => (
                        <span key={index} className="inline-block text-sm font-semibold mr-1 mb-1">
                            <TagCard tagName={tag} />
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex items-center mt-2">
                <div className="flex items-center mr-4">
                    <img src={thumbUpIcon} alt="Thumb up" className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-base-content ml-1">{countLikes}</span>
                </div>
                <div className="flex items-center">
                    <img src={thumbDownIcon} alt="Thumb down" className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-base-content ml-1">{countDislikes}</span>
                </div>
            </div>
        </div>
    );
}
