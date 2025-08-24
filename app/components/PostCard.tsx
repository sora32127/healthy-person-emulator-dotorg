import { NavLink } from "@remix-run/react";
import TagCard from "./TagCard";
import RelativeDate from "./RelativeDate";
import CommentIcon from "./icons/CommentIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";
import ClockIcon from "./icons/ClockIcon";
import ArticleIcon from "./icons/ArticleIcon";
import TagIcon from "./icons/TagIcon";


export interface PostCardProps {
    postId: number;
    postTitle: string;
    postDateGmt: Date;
    tagNames: string[];
    countLikes: number;
    countDislikes: number;
    highLightedText?: string;
    countComments?: number;
    identifier?: string; 
    /*
    トップページにおいては、同じ投稿が二回以上表示されることがある。たとえば、「新着順」と「いいね順」の両方にリストアップされる場合が該当する。
    この場合、PostCardコンポーネントのKeyが重複してしまうため、Keyを指定するためのPropsを用意する必要がある。identifierプロップは、PostCardコンポーネントのKeyとして使用することを想定しているが、トップページ以外での利用は想定していない。
    
    */
}

export default function PostCard({
    postId,
    postTitle,
    postDateGmt,
    tagNames,
    countLikes,
    countDislikes,
    countComments,
    identifier,
}: PostCardProps) {
    const displayedTags = tagNames.slice(0, 5);
    const hiddenTagsCount = tagNames.length - displayedTags.length;

    return (
        <div className="bg-base-100 p-4 my-1 border-b border-neutral">
            <div className="mx-2">
                <div className="flex flex-row my-1 justify-start gap-x-4">
                    <div className="flex">
                        <div className="pr-2">
                            <ClockIcon/>
                        </div>
                        <RelativeDate targetDate={postDateGmt} />
                    </div>
                    <div className="flex items-center gap-x-2">
                        <div className="flex gap-x-1">
                            <ThumbsUpIcon />
                            <span>{countLikes}</span>
                        </div>
                        <div className="flex gap-x-1">
                            <ThumbsDownIcon />
                            <span>{countDislikes}</span>
                        </div>
                        {countComments !== undefined && (
                        <div className="flex items-center">
                            <CommentIcon/>
                            <span className="text-sm text-base-content ml-1">{countComments}</span>
                        </div>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                    <div className="w-6 h-6">
                        <ArticleIcon />
                    </div>
                        <NavLink to={`/archives/${postId}`} className="text-xl font-bold post-title hover:underline hover:underline-offset-4">{postTitle}</NavLink>
                    </div>
                <div className="grid grid-cols-[auto_1fr] gap-2 mb-2 items-center">
                    <div className="w-6 h-6">
                    <TagIcon />
                    </div>
                    <div className="flex flex-wrap gap-y-3 my-2">
                        {displayedTags.map((tag, index) => (
                            tag && (
                            <span key={`${tag}-${postId}-${identifier}`} className="inline-block mr-1 mb-1">
                                <TagCard tagName={tag} />
                            </span>
                            )
                        ))}
                        {hiddenTagsCount > 0 && (
                            <span className="inline-block text-base-content">
                                (+{hiddenTagsCount}タグ)
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="col-span-1" />
        </div>
    );
}