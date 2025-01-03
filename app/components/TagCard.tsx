import { NavLink } from "@remix-run/react";

interface TagCardProps {
    tagName: string;
}

export default function TagCard({
    tagName,
}: TagCardProps) {
    return (
        <div className="rounded-md p-0.5 mb-0.5 badge border-none">
            <NavLink to={`/tags/${tagName}`} className="text-xs post-tag rounded-lg bg-base-300 px-2 py-1 hover:bg-base-200" viewTransition>{tagName}</NavLink>
        </div>
    );
}