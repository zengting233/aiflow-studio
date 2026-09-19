import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';
import { resolveTemplate } from '../../utils/workflow-context.util';

@Injectable()
export class OutputNodeExecutor implements INodeExecutor {
  async execute(node: any, context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { outputValue } = nodeData;

    const resolvedOutput = resolveTemplate(outputValue, context);

    return { finalOutput: resolvedOutput };
  }
}
