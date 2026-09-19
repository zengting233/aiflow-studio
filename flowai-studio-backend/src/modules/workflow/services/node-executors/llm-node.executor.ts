import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';
import { LLMInvocationService } from '../../../agent/services/llm-invocation.service';
import { resolveTemplate } from '../../utils/workflow-context.util';

@Injectable()
export class LLMNodeExecutor implements INodeExecutor {
  constructor(private readonly llmInvocationService: LLMInvocationService) {}

  async execute(node: any, context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { model, systemPrompt, userPrompt, temperature, maxTokens } = nodeData;

    // 替换上下文变量
    const resolvedUserPrompt = resolveTemplate(userPrompt, context);

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    }
    messages.push({ role: 'user' as const, content: resolvedUserPrompt });

    const response = await this.llmInvocationService.invoke(
      { messages, model, temperature, maxTokens },
      {
        userId: context._userId as string | undefined,
        applicationId: context._applicationId as string | undefined,
        workflowId: context._workflowId as string | undefined,
        executionId: context._executionId as string | undefined,
        callType: 'chat',
      },
    );

    return { result: response.content };
  }
}
