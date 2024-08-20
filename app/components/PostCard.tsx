import { NavLink } from "@remix-run/react";
import TagCard from "./TagCard";
import RelativeDate from "./RelativeDate";
import { LiaThumbsUpSolid, LiaThumbsDownSolid } from "react-icons/lia";
import { FaRegComments } from "react-icons/fa6";
import CommentIcon from "./icons/CommentIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";

export interface PostCardProps {
    postId: number;
    postTitle: string;
    postDateGmt: string;
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
        <div className="bg-base-100 p-4 grid grid-cols-[1fr_minmax(auto,_800px)_1fr] my-2">
            <div className="col-span-1" />
            <div className="mx-2">
                <div className="flex flex-row my-2 justify-between">
                    <div className="flex items-center">
                        <RelativeDate timestamp={postDateGmt} />
                    </div>
                    <div className="flex items-center gap-x-4">
                        <div className="flex items-center">
                            <ThumbsUpIcon/>
                            <span className="text-sm text-base-content ml-1">{countLikes}</span>
                        </div>
                        <div className="flex items-center">
                            <ThumbsDownIcon/>
                            <span className="text-sm text-base-content ml-1">{countDislikes}</span>
                        </div>
                        {countComments !== undefined && (
                            <div className="flex items-center">
                                <CommentIcon/>
                                <span className="text-sm text-base-content ml-1">{countComments}</span>
                            </div>
                        )}
                    </div>
                </div>
                <NavLink to={`/archives/${postId}`} className="hover:underline hover:underline-offset-4">
                    <img src={`https://healthy-person-emulator-public-assets.s3.ap-northeast-1.amazonaws.com/${postId}.jpg`} alt={postTitle} className="w-full object-cover" loading="lazy"/>
                    <div className="mt-1 mb-2">
                        <p className="text-xl">{postTitle}</p>
                    </div>
                </NavLink>
                <div>
                    <div className="flex flex-wrap items-center">
                        {displayedTags.map((tag, index) => (
                            <span key={`${tag}-${postId}-${identifier}`} className="inline-block mr-1 mb-1">
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
            </div>
            <div className="col-span-1" />
        </div>
    );
}