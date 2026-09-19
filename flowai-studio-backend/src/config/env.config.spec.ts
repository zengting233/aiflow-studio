import { envSchema } from './env.config';

describe('envSchema', () => {
  it('does not require unconfigured optional LLM provider keys', () => {
    const config = envSchema.parse({
      JWT_SECRET: 'test-secret',
      QWEN_API_KEY: 'test-qwen-key',
      DATABASE_URL: 'postgresql://localhost/test',
    });

    expect(config.QWEN_API_KEY).toBe('test-qwen-key');
    expect(config.OPENAI_API_KEY).toBeUndefined();
    expect(config.ANTHROPIC_API_KEY).toBeUndefined();
    expect(config.GOOGLE_API_KEY).toBeUndefined();
  });
});
