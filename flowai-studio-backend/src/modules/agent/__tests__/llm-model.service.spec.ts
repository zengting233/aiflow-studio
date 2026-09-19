import { LLMProviderFactory } from '../providers/llm-provider.factory';
import { LLMModelService } from '../services/llm-model.service';
import { LLMProviderType } from '../interfaces/llm-provider.interface';

describe('LLMModelService', () => {
  it('reports configuration state per provider without a health check', () => {
    const providerTypes: LLMProviderType[] = [
      'openai',
      'claude',
      'gemini',
      'qwen',
      'ollama',
    ];
    const providerFactory = {
      getRegisteredTypes: jest.fn().mockReturnValue(
        providerTypes.map((type) => ({ type, description: `${type} models` })),
      ),
      isProviderConfigured: jest.fn(
        (type: LLMProviderType) => type === 'qwen',
      ),
      create: jest.fn((type: LLMProviderType) => ({
        supportedModels: [
          {
            id: `${type}-model`,
            displayName: `${type} model`,
            provider: type,
            capabilities: {},
          },
        ],
      })),
      healthCheckAll: jest.fn(),
    };
    const service = new LLMModelService(
      providerFactory as unknown as LLMProviderFactory,
    );

    const groups = service.getModelsGroupByProvider();

    expect(groups.qwen.configured).toBe(true);
    expect(groups.qwen.models[0].configured).toBe(true);
    expect(groups.openai.configured).toBe(false);
    expect(groups.claude.configured).toBe(false);
    expect(groups.gemini.configured).toBe(false);
    expect(groups.ollama.configured).toBe(false);
    expect(providerFactory.healthCheckAll).not.toHaveBeenCalled();
  });
});
