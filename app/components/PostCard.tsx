import { NavLink } from "@remix-run/react";
import parse from "html-react-parser";
import TagCard from "./TagCard";
import ArticleIcon from "./icons/ArticleIcon";
import TagIcon from "./icons/TagIcon";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";
import RelativeDate from "./RelativeDate";

export interface PostCardProps {
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

    tagNames.sort((a, b) => {
        if (a > b) {
            return 1;
        }
        if (a < b) {
            return -1;
        }
        return 0;
    });

    const displayedTags = tagNames.slice(0, 5);
    const hiddenTagsCount = tagNames.length - displayedTags.length;

    return (
        <div className="bg-base-100 border-2 rounded-lg p-4 mb-4">
            <RelativeDate timestamp={postDateGmt} />
            <div className="grid grid-cols-[auto_1fr] gap-2 mb-2 items-center">
                <ArticleIcon/>
                <NavLink to={`/archives/${postId}`} className="text-xl font-bold text-info underline underline-offset-4 post-title">{postTitle}</NavLink>
            </div>
            {highLightedText && (
                <p className="neutral-content">{parse(highLightedText)}</p>
            )}
            <div className="grid grid-cols-[auto_1fr] gap-2 mt-2 items-center">
                <TagIcon/>
                <div className="flex flex-wrap items-center">
                    {displayedTags.map((tag, index) => (
                        <span key={index} className="inline-block mr-1 mb-1">
                            <TagCard tagName={tag} />
                        </span>
                    ))}
                    {hiddenTagsCount > 0 && (
                        <span className="inline-block text-base-content">
                            (+{hiddenTagsCount}タグ)
                        </span>
                    )}
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