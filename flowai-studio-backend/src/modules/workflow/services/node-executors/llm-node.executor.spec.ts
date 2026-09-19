import { LLMNodeExecutor } from './llm-node.executor';

describe('LLMNodeExecutor', () => {
  it('uses LLMInvocationService and preserves the node output shape', async () => {
    const invocationService = {
      invoke: jest.fn().mockResolvedValue({ content: 'resolved answer' }),
    };
    const executor = new LLMNodeExecutor(invocationService as any);
    const context = {
      question: 'hello',
      _userId: 'user-1',
      _applicationId: 'app-1',
      _workflowId: 'workflow-1',
      _executionId: 'execution-1',
    };

    await expect(
      executor.execute(
        {
          data: {
            model: 'qwen-plus',
            systemPrompt: 'system',
            userPrompt: '{{question}}',
            temperature: 0.2,
            maxTokens: 100,
          },
        },
        context,
      ),
    ).resolves.toEqual({ result: 'resolved answer' });

    expect(invocationService.invoke).toHaveBeenCalledWith(
      {
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'hello' },
        ],
        model: 'qwen-plus',
        temperature: 0.2,
        maxTokens: 100,
      },
      {
        userId: 'user-1',
        applicationId: 'app-1',
        workflowId: 'workflow-1',
        executionId: 'execution-1',
        callType: 'chat',
      },
    );
  });
});
