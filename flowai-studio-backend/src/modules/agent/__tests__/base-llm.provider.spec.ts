import { BaseLLMProvider } from '../providers/base-llm.provider';
import {
  LLMChatParams,
  LLMResponse,
} from '../interfaces/llm-provider.interface';

class TestProvider extends BaseLLMProvider {
  constructor() {
    super('qwen', 'qwen-turbo', [], {});
  }

  chat(): Promise<LLMResponse> {
    return Promise.resolve({ content: '' });
  }

  async *chatStream(): AsyncIterable<string> {}

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public requestBody(params: LLMChatParams) {
    return this.buildRequestBody(params);
  }
}

describe('BaseLLMProvider message conversion', () => {
  it('converts assistant toolCalls and tool toolCallId for OpenAI-compatible APIs', () => {
    const provider = new TestProvider();
    const body = provider.requestBody({
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'call-1', name: 'tool_skill_4', arguments: { input: 'x' } },
          ],
        },
        { role: 'tool', content: '{"ok":true}', toolCallId: 'call-1' },
      ],
    });

    expect(body.messages).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'tool_skill_4',
              arguments: '{"input":"x"}',
            },
          },
        ],
      },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'call-1' },
    ]);
  });

  it('omits absent tool fields', () => {
    const provider = new TestProvider();
    const [message] = provider.requestBody({
      messages: [{ role: 'user', content: 'hello' }],
    }).messages;

    expect(message).toEqual({ role: 'user', content: 'hello' });
    expect(message).not.toHaveProperty('tool_calls');
    expect(message).not.toHaveProperty('tool_call_id');
  });
});
