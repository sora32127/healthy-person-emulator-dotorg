import { NavLink } from "@remix-run/react";

interface TagCardProps {
    tagName: string;
}

export default function TagCard({
    tagName,
}: TagCardProps) {
    return (
        <div className="rounded-md p-0.5 mb-0.5 badge border-none">
            <NavLink to={`/tags/${tagName}`} className="text-xs text-info underline underline-offset-4 post-tag">{tagName}</NavLink>
        </div>
    );
}