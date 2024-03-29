import { NavLink } from "@remix-run/react";

interface TagCardProps {
    tagName: string;
}

export default function TagCard({
    tagName,
}: TagCardProps) {
    return (
        <div className="rounded-md p-1 mb-4">
            <NavLink to={`/tags/${tagName}`} className="text-lg font-bold text-blue-700 underline underline-offset-4 decoration-blue-700">{tagName}</NavLink>
        </div>
    );
}