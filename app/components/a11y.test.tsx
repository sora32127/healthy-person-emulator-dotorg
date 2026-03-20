import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router';
import { VoteButton } from './VoteButton';
import { Footer } from './Footer';
import PostCard from './PostCard';
import TagCard from './TagCard';

async function checkA11y(container: HTMLElement) {
  const results = await axe.run(container);
  const violations = results.violations.map(
    (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`,
  );
  expect(violations, `a11y violations:\n${violations.join('\n')}`).toHaveLength(0);
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('アクセシビリティテスト', () => {
  it('VoteButton: a11y違反がないこと', async () => {
    const { container } = render(
      <VoteButton
        type="like"
        count={5}
        isAnimating={false}
        isVoted={false}
        disabled={false}
        onClick={() => {}}
      />,
    );
    await checkA11y(container);
  });

  it('Footer: a11y違反がないこと', async () => {
    const { container } = renderWithRouter(<Footer />);
    await checkA11y(container);
  });

  it('PostCard: a11y違反がないこと', async () => {
    const { container } = renderWithRouter(
      <PostCard
        postId={1}
        postTitle="テスト記事タイトル"
        postDateGmt={new Date('2025-01-01')}
        tagNames={['タグ1', 'タグ2']}
        countLikes={10}
        countDislikes={2}
        countComments={5}
      />,
    );
    await checkA11y(container);
  });

  it('TagCard: a11y違反がないこと', async () => {
    const { container } = renderWithRouter(<TagCard tagName="テストタグ" />);
    await checkA11y(container);
  });
});
