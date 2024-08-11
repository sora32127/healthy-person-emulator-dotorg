import { NavLink } from "@remix-run/react";
import TagCard from "./TagCard";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";
import RelativeDate from "./RelativeDate";
import ClockIcon from "./icons/ClockIcon";

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
        <div className="bg-base-100 border-b border-neutral p-4">
            <div className="flex my-1">
                <div className="pr-2">
                <ClockIcon/>
                </div>
                <RelativeDate timestamp={postDateGmt} />
            </div>
            <NavLink to={`/archives/${postId}`} className="hover:underline hover:underline-offset-4">
                <img src={`https://healthy-person-emulator-public-assets.s3.ap-northeast-1.amazonaws.com/${postId}.jpg`} alt={postTitle}/>
                <div className="mt-1 mb-2">
                    <p className="text-xl">{postTitle}</p>
                </div>
            </NavLink>
            <div>
                <div className="flex flex-wrap items-center">
                    {displayedTags.map((tag, index) => (
                        <span key={`${tag}-${postId}`} className="inline-block mr-1 mb-1">
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