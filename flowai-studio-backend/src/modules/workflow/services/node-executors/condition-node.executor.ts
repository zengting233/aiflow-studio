import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';
import { resolveContextValue } from '../../utils/workflow-context.util';

@Injectable()
export class ConditionNodeExecutor implements INodeExecutor {
  async execute(node: any, context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { conditions } = nodeData;

    let result = true;
    if (conditions && Array.isArray(conditions)) {
      for (const condition of conditions) {
        const { variable, operator, value } = condition;
        const contextValue = resolveContextValue(variable, context);
        if (!this.evaluate(contextValue, operator, value)) {
          result = false;
          break;
        }
      }
    }

    return { result };
  }
  private evaluate(contextValue: any, operator: string, value: any): boolean {
    switch (operator) {
      case '===':
        return contextValue === value;
      case '!==':
        return contextValue !== value;
      case '>':
        return contextValue > value;
      case '<':
        return contextValue < value;
      case '>=':
        return contextValue >= value;
      case '<=':
        return contextValue <= value;
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(value);
      default:
        return false;
    }
  }
}
