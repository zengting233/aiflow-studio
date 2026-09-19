import { LLMInvocationService } from '../services/llm-invocation.service';

describe('LLMInvocationService', () => {
  const usage = {
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
  };
  let provider: any;
  let providerFactory: any;
  let tokenUsageService: any;
  let service: LLMInvocationService;

  beforeEach(() => {
    provider = {
      name: 'qwen',
      chat: jest.fn().mockResolvedValue({ content: 'ok', usage }),
    };
    providerFactory = {
      getProviderForModel: jest.fn().mockReturnValue(provider),
    };
    tokenUsageService = { recordFromResponse: jest.fn() };
    service = new LLMInvocationService(providerFactory, tokenUsageService);
  });

  it('routes through the factory and records returned usage with provider.name', async () => {
    const response = await service.invoke(
      { model: 'qwen-plus', messages: [{ role: 'user', content: 'hello' }] },
      {
        userId: 'user-1',
        applicationId: 'app-1',
        workflowId: 'workflow-1',
        executionId: 'execution-1',
        callType: 'agent',
      },
    );

    expect(response.content).toBe('ok');
    expect(providerFactory.getProviderForModel).toHaveBeenCalledWith('qwen-plus');
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen-plus' }),
    );
    expect(tokenUsageService.recordFromResponse).toHaveBeenCalledWith({
      userId: 'user-1',
      applicationId: 'app-1',
      workflowId: 'workflow-1',
      executionId: 'execution-1',
      provider: 'qwen',
      model: 'qwen-plus',
      usage,
      callType: 'agent',
    });
  });

  it('does not record when usage is absent', async () => {
    provider.chat.mockResolvedValue({ content: 'ok' });

    await expect(
      service.invoke(
        { model: 'qwen-turbo', messages: [{ role: 'user', content: 'hello' }] },
        { userId: 'user-1', callType: 'chat' },
      ),
    ).resolves.toEqual({ content: 'ok' });
    expect(tokenUsageService.recordFromResponse).not.toHaveBeenCalled();
  });

  it('does not record without a user id', async () => {
    await service.invoke(
      { model: 'qwen-turbo', messages: [{ role: 'user', content: 'hello' }] },
      { callType: 'agent' },
    );
    expect(tokenUsageService.recordFromResponse).not.toHaveBeenCalled();
  });
});
