import { render, screen, fireEvent } from "@testing-library/react";
import CommentCard from "./CommentCard";
import { vi, describe, it, expect } from "vitest";
import '@testing-library/jest-dom/vitest';

const mockCommentCardProps = {
    commentId: 1,
    commentDateGmt: new Date(),
    commentAuthor: "test",
    commentContent: "test",
    level: 1,
    onCommentVote: vi.fn(),
    onCommentSubmit: vi.fn(),
    likedComments: [],
    dislikedComments: [],
    likesCount: 0,
    dislikesCount: 0,
    postId: 1,
    isCommentOpen: false,
    postTitle: "test",
}

describe("CommentCard", () => {
    it("コメントに対するいいねボタンをクリックすると、クリック時のアニメーションが発動する", () => {
        const { container } = render(<CommentCard {...mockCommentCardProps} />);
        const goodButton = container.querySelector("button[class*='like']") as HTMLButtonElement;
        fireEvent.click(goodButton);
        expect(goodButton).toHaveClass("animate-voteSpin bg-base-300");
    });
    
});