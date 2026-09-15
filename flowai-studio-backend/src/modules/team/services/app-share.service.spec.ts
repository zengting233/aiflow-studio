import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppShareService } from './app-share.service';

describe('AppShareService public execution', () => {
  const prisma = {
    appShare: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const workflowExecutor = {
    executeWorkflow: jest.fn(),
  } as any;
  let service: AppShareService;

  const nodes = [
    { id: 'userInput_1', type: 'userInput', data: { label: '问题', inputField: 'question' } },
    { id: 'output_1', type: 'output', data: { label: '回答' } },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppShareService(prisma, workflowExecutor);
  });

  it('returns the input contract of the shared workflow', async () => {
    prisma.appShare.findUnique.mockResolvedValue({
      isPublic: true,
      embedConfig: null,
      application: {
        id: 'app-1',
        name: '问答助手',
        description: null,
        icon: null,
        status: 'published',
        workflows: [{ id: 'workflow-1', nodes: JSON.stringify(nodes) }],
      },
    });

    const result = await service.getSharedApp('share-1');

    expect(result.hasWorkflow).toBe(true);
    expect(result.inputs).toEqual([
      { nodeId: 'userInput_1', field: 'question', label: '问题' },
    ]);
  });

  it('executes only the workflow bound to the shared application', async () => {
    prisma.appShare.findUnique.mockResolvedValue({
      isPublic: true,
      application: {
        userId: 'owner-1',
        workflows: [{ id: 'workflow-1', nodes: JSON.stringify(nodes) }],
      },
    });
    workflowExecutor.executeWorkflow.mockResolvedValue({
      output_1: { finalOutput: '这是结果' },
    });
    prisma.appShare.update.mockResolvedValue({});

    await expect(service.runSharedApp('share-1', { question: '你好' })).resolves.toEqual({
      output: '这是结果',
    });
    expect(workflowExecutor.executeWorkflow).toHaveBeenCalledWith('workflow-1', {
      inputs: { question: '你好' },
      userId: 'owner-1',
    });
    expect(prisma.appShare.update).toHaveBeenCalledWith({
      where: { shareLink: 'share-1' },
      data: { accessCount: { increment: 1 } },
    });
  });

  it('rejects missing required input before executing', async () => {
    prisma.appShare.findUnique.mockResolvedValue({
      isPublic: true,
      application: {
        userId: 'owner-1',
        workflows: [{ id: 'workflow-1', nodes: JSON.stringify(nodes) }],
      },
    });

    await expect(service.runSharedApp('share-1', {})).rejects.toThrow(BadRequestException);
    expect(workflowExecutor.executeWorkflow).not.toHaveBeenCalled();
  });

  it('rejects a disabled or unknown share link', async () => {
    prisma.appShare.findUnique.mockResolvedValue(null);

    await expect(service.runSharedApp('share-missing', {})).rejects.toThrow(NotFoundException);
  });
});
