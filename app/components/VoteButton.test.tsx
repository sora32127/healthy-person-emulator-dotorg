import { VoteButton } from './VoteButton';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
describe('VoteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('いいねボタンが正しくレンダリングされる', () => {
    render(
      <VoteButton
        type="like"
        count={0}
        isAnimating={false}
        isVoted={false}
        disabled={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('いいねボタンがクリックされたときにonClickが呼ばれる', () => {
    const mockOnClick = vi.fn();
    render(
      <VoteButton
        type="like"
        count={0}
        isAnimating={false}
        isVoted={false}
        disabled={false}
        onClick={mockOnClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('disabledの場合はクリックできない', () => {
    const mockOnClick = vi.fn();
    render(
      <VoteButton
        type="like"
        count={0}
        isAnimating={false}
        isVoted={false}
        disabled={true}
        onClick={mockOnClick}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('力になりたいボタンはアイコンと件数を表示する', () => {
    render(
      <VoteButton
        type="support"
        count={3}
        isAnimating={false}
        isVoted={false}
        disabled={false}
        onClick={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: '力になりたい 3件' });
    expect(button.querySelector('svg')).toBeInTheDocument();
    expect(button.textContent).toBe('3');
  });

  it('アニメーション中は適切なクラスが適用される', () => {
    render(
      <VoteButton
        type="like"
        count={0}
        isAnimating={true}
        isVoted={false}
        disabled={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toHaveClass('animate-voteSpin bg-base-300');
  });

  it('投票済みの場合は適切なクラスが適用される', () => {
    render(
      <VoteButton
        type="like"
        count={0}
        isAnimating={false}
        isVoted={true}
        disabled={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toHaveClass('text-secondary font-bold bg-base-300');
  });
});
