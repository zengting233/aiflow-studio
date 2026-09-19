import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';
import { RAGService } from '../../../rag/services/rag.service';
import { resolveTemplate } from '../../utils/workflow-context.util';

@Injectable()
export class RAGNodeExecutor implements INodeExecutor {
  constructor(private readonly ragService: RAGService) {}

  async execute(node: any, context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { knowledgeBaseId, query, topK, similarityThreshold } = nodeData;

    const resolvedQuery = resolveTemplate(query, context);

    const documents = await this.ragService.retrieve(
      resolvedQuery,
      knowledgeBaseId,
      topK,
      undefined,
      undefined,
      undefined,
      similarityThreshold,
    );

    return { documents };
  }
}
