import { Injectable } from '@nestjs/common';
import {
  LLMChatParams,
  LLMResponse,
} from '../interfaces/llm-provider.interface';
import { LLMProviderFactory } from '../providers/llm-provider.factory';
import { TokenUsageService } from './token-usage.service';

export interface LLMInvocationContext {
  userId?: string;
  applicationId?: string;
  workflowId?: string;
  executionId?: string;
  callType: 'chat' | 'agent';
}

@Injectable()
export class LLMInvocationService {
  constructor(
    private readonly providerFactory: LLMProviderFactory,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  async invoke(
    params: LLMChatParams,
    context?: LLMInvocationContext,
  ): Promise<LLMResponse> {
    const model = params.model || 'qwen-turbo';
    const provider = this.providerFactory.getProviderForModel(model);
    const response = await provider.chat({ ...params, model });

    if (context?.userId && response.usage && response.usage.totalTokens > 0) {
      this.tokenUsageService.recordFromResponse({
        userId: context.userId,
        applicationId: context.applicationId,
        workflowId: context.workflowId,
        executionId: context.executionId,
        provider: provider.name,
        model,
        usage: response.usage,
        callType: context.callType,
      });
    }

    return response;
  }
}
