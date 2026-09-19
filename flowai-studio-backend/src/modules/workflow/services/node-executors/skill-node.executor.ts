import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';
import { SkillService } from '../../../skill/services/skill.service';
import { resolveTemplate } from '../../utils/workflow-context.util';

@Injectable()
export class SkillNodeExecutor implements INodeExecutor {
  constructor(private readonly skillService: SkillService) {}

  async execute(node: any, context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { skillId, parameters } = nodeData;

    const resolvedParams = this.resolveParameters(parameters, context);

    const result = await this.skillService.executeSkill(skillId, resolvedParams);

    return { result };
  }

  private resolveParameters(params: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const resolvedParams: Record<string, any> = {};
    if (!params) return resolvedParams;
    
    for (const key in params) {
      const value = params[key];
      if (typeof value === 'string') {
        resolvedParams[key] = resolveTemplate(value, context);
      } else {
        resolvedParams[key] = value;
      }
    }
    return resolvedParams;
  }
}
