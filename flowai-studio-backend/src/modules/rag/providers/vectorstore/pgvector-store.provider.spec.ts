import { PgVectorStore } from './pgvector-store.provider';

describe('PgVectorStore', () => {
  it('casts text metadata to jsonb before applying filters', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    const store = new PgVectorStore(prisma as any);

    await store.search('kb1', {
      queryVector: [0.1, 0.2],
      filter: { match: { key: 'knowledgeBaseId', value: 'kb1' } },
    });

    expect(prisma.$queryRawUnsafe.mock.calls[0][0]).toContain(
      "(metadata::jsonb)->>'knowledgeBaseId' = 'kb1'",
    );
  });
});
