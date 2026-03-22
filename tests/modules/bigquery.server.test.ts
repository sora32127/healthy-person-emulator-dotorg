import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryBigQuery } from '~/modules/bigquery.server';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('jose', () => {
  const mockInstance = {
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuer: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setAudience: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock-jwt'),
  };
  return {
    importPKCS8: vi.fn().mockResolvedValue('mock-key'),
    SignJWT: vi.fn().mockImplementation(function () {
      return mockInstance;
    }),
  };
});

describe('queryBigQuery', () => {
  beforeEach(() => mockFetch.mockReset());

  it('クエリを実行して結果を返す', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'bq-token' }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          rows: [{ f: [{ v: '123' }, { v: 'テスト記事' }] }],
          schema: { fields: [{ name: 'post_id' }, { name: 'post_title' }] },
        }),
        { status: 200 },
      ),
    );

    const credsJson = JSON.stringify({
      client_email: 'test@test.iam.gserviceaccount.com',
      private_key: 'fake-key',
      private_key_id: 'kid',
      project_id: 'test-project',
    });

    const rows = await queryBigQuery(credsJson, 'SELECT * FROM table');
    expect(rows).toEqual([{ post_id: '123', post_title: 'テスト記事' }]);
  });
});
