import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../common/services/prisma.service';
import { WorkflowExecutorService } from '../../workflow/services/workflow-executor.service';

@Injectable()
export class AppShareService {
  constructor(
    private prisma: PrismaService,
    private workflowExecutorService: WorkflowExecutorService,
  ) {}

  /**
   * 生成分享链接
   */
  async generateShareLink(userId: string, applicationId: string) {
    await this.assertAppOwner(userId, applicationId);

    // 如果已有分享记录则复用
    const existingShare = await this.prisma.appShare.findUnique({
      where: { applicationId },
    });

    if (existingShare) {
      return {
        id: existingShare.id,
        shareLink: existingShare.shareLink,
        isPublic: existingShare.isPublic,
        accessCount: existingShare.accessCount,
        embedConfig: this.parseEmbedConfig(existingShare.embedConfig),
        createdAt: existingShare.createdAt,
      };
    }

    const shareLink = `share-${crypto.randomBytes(16).toString('hex')}`;

    const appShare = await this.prisma.appShare.create({
      data: {
        shareLink,
        isPublic: true,
        applicationId,
      },
      select: { id: true, shareLink: true, isPublic: true },
    });

    // 同时更新 Application.shareLink 以便快速查找
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { shareLink },
    });

    return appShare;
  }

  /**
   * 通过分享链接获取应用（公开访问，无需认证）
   */
  async getSharedApp(shareLink: string) {
    const appShare = await this.prisma.appShare.findUnique({
      where: { shareLink },
      select: {
        isPublic: true,
        embedConfig: true,
        application: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            status: true,
            workflows: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { id: true, nodes: true },
            },
          },
        },
      },
    });

    if (!appShare || !appShare.isPublic) {
      throw new NotFoundException('分享的应用不存在或已关闭分享');
    }

    const { workflows, ...application } = appShare.application;
    const workflow = workflows[0];
    const nodes = workflow ? this.parseNodes(workflow.nodes) : [];

    return {
      ...application,
      isPublic: appShare.isPublic,
      shareLink,
      embedConfig: this.parseEmbedConfig(appShare.embedConfig),
      hasWorkflow: Boolean(workflow),
      inputs: nodes
        .filter((node) => node.type === 'userInput')
        .map((node) => ({
          nodeId: node.id,
          field: typeof node.data?.inputField === 'string' ? node.data.inputField.trim() : '',
          label: node.data?.label || '用户输入',
        }))
        .filter((input) => input.field),
    };
  }

  /** 执行公开分享应用，工作流由分享记录在服务端确定。 */
  async runSharedApp(shareLink: string, inputs: Record<string, unknown>) {
    const appShare = await this.prisma.appShare.findUnique({
      where: { shareLink },
      select: {
        isPublic: true,
        application: {
          select: {
            userId: true,
            workflows: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { id: true, nodes: true },
            },
          },
        },
      },
    });

    if (!appShare || !appShare.isPublic) {
      throw new NotFoundException('分享的应用不存在或已关闭分享');
    }

    const workflow = appShare.application.workflows[0];
    if (!workflow) throw new BadRequestException('该应用尚未配置工作流');

    const nodes = this.parseNodes(workflow.nodes);
    const requiredInputs = nodes
      .filter((node) => node.type === 'userInput')
      .map((node) => ({
        field: typeof node.data?.inputField === 'string' ? node.data.inputField.trim() : '',
        label: node.data?.label || '用户输入',
      }))
      .filter((input) => input.field);

    for (const input of requiredInputs) {
      if (inputs[input.field] === undefined || inputs[input.field] === null || inputs[input.field] === '') {
        throw new BadRequestException(`请填写“${input.label}”`);
      }
    }

    const context = await this.workflowExecutorService.executeWorkflow(workflow.id, {
      inputs,
      userId: appShare.application.userId,
    });

    const output = nodes
      .filter((node) => node.type === 'output')
      .map((node) => context[node.id]?.finalOutput)
      .find((value) => value !== undefined);

    if (output === undefined) {
      throw new BadRequestException('工作流没有产生最终输出，请检查输出节点及其连线');
    }

    await this.prisma.appShare.update({
      where: { shareLink },
      data: { accessCount: { increment: 1 } },
    });

    return { output };
  }

  /**
   * 更新分享设置
   */
  async updateShareSettings(
    userId: string,
    applicationId: string,
    settings: {
      isPublic?: boolean;
      embedConfig?: { allowedOrigins?: string[]; theme?: string };
    },
  ) {
    await this.assertAppOwner(userId, applicationId);

    const appShare = await this.prisma.appShare.findUnique({
      where: { applicationId },
    });

    if (!appShare) {
      throw new NotFoundException('请先生成分享链接');
    }

    const data: any = {};
    if (settings.isPublic !== undefined) data.isPublic = settings.isPublic;
    if (settings.embedConfig) data.embedConfig = JSON.stringify(settings.embedConfig);

    const updated = await this.prisma.appShare.update({
      where: { applicationId },
      data,
      select: {
        id: true,
        shareLink: true,
        isPublic: true,
        embedConfig: true,
      },
    });

    return {
      ...updated,
      embedConfig: this.parseEmbedConfig(updated.embedConfig),
    };
  }

  /**
   * 撤销分享链接
   */
  async revokeShareLink(userId: string, applicationId: string) {
    await this.assertAppOwner(userId, applicationId);

    // 删除 AppShare 记录
    const result = await this.prisma.appShare.deleteMany({
      where: { applicationId },
    });

    // 同时清除 Application.shareLink
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { shareLink: null },
    });

    return { success: true, deleted: result.count };
  }

  /**
   * 获取嵌入代码
   */
  async getEmbedCode(userId: string, applicationId: string) {
    const app = await this.assertAppOwner(userId, applicationId);

    const appShare = await this.prisma.appShare.findUnique({
      where: { applicationId },
    });

    if (!appShare) {
      throw new ForbiddenException('请先生成分享链接');
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const shareUrl = `${baseUrl}/share/${appShare.shareLink}`;

    const embedConfig = appShare.embedConfig ? JSON.parse(appShare.embedConfig as string) : {};
    const theme = embedConfig.theme || 'light';

    return {
      shareUrl,
      iframeCode: `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" style="border-radius: 8px;"></iframe>`,
      scriptCode: `<script src="${baseUrl}/embed.js" data-app="${appShare.shareLink}" data-theme="${theme}"></script>`,
      embedConfig: embedConfig,
    };
  }

  /**
   * 断言应用所有权
   */
  private async assertAppOwner(userId: string, applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app) throw new NotFoundException('应用不存在');
    if (app.userId !== userId) throw new ForbiddenException('只有应用所有者才能管理分享设置');

    return app;
  }

  private parseNodes(value: string): any[] {
    try {
      const nodes = JSON.parse(value);
      return Array.isArray(nodes) ? nodes : [];
    } catch {
      return [];
    }
  }

  private parseEmbedConfig(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string') return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
