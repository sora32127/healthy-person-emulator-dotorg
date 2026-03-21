import { describe, test, expect } from 'vitest';

describe('API Key format', () => {
  function generateApiKey(): string {
    return `hpe_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  test('hpe_プレフィクス付きの32文字hexキーが生成される', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^hpe_[a-f0-9]{32}$/);
  });

  test('生成されるキーは毎回異なる', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });

  test('キーの全体長は36文字（hpe_ + 32文字hex）', () => {
    const key = generateApiKey();
    expect(key.length).toBe(36);
  });
});
