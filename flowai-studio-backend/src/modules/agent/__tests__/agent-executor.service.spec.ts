/**
 * AgentExecutorService 单元测试
 *
 * Phase 3.1 + 3.2 测试覆盖:
 * - Single Agent ReAct 循环
 * - 工具调用与结果处理
 * - 最大迭代次数限制
 * - Supervisor/Worker 模式
 * - RAG 集成
 * - 执行轨迹
 * - 错误处理
 * - 多模型路由
 */
import { AgentExecutorService } from '../services/agent-executor.service';
import { AgentNodeConfig } from '../interfaces/agent.interface';

describe('AgentExecutorService', () => {
  let agentExecutor: AgentExecutorService;
  let mockInvocationService: any;
  let mockSkillService: any;
  let mockRAGService: any;
  let mockPrismaService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInvocationService = {
      invoke: jest.fn(),
    };

    // Mock SkillService
    mockSkillService = {
      getBuiltinSkills: jest.fn().mockResolvedValue([
        { type: 'calculator', name: '计算器', description: '计算数学表达式', inputSchema: { type: 'object', properties: { expression: { type: 'string' } } } },
      ]),
      findSkillById: jest.fn(),
      executeSkill: jest.fn(),
    };

    // Mock RAGService
    mockRAGService = {
      retrieve: jest.fn(),
    };

    // Mock PrismaService
    mockPrismaService = {
      skill: {
        findUnique: jest.fn(),
      },
    };

    agentExecutor = new AgentExecutorService(
      mockInvocationService as any,
      mockSkillService as any,
      mockRAGService as any,
      mockPrismaService as any,
    );
  });

  // ============================================================
  // Single Agent
  // ============================================================

  describe('Single Agent', () => {
    const singleConfig: AgentNodeConfig = {
      mode: 'single',
      strategy: 'react',
      maxIterations: 10,
      memoryEnabled: false,
      memoryWindowSize: 10,
      singleAgent: {
        id: 'test_agent',
        name: '测试助手',
        description: '测试用',
        systemPrompt: '你是一个测试助手。',
        model: 'qwen-turbo',
        temperature: 0.7,
        maxTokens: 2048,
        toolIds: [],
        knowledgeBaseIds: [],
        ragEnabled: false,
      },
    };

    it('should execute a single agent with direct answer', async () => {
      mockInvocationService.invoke.mockResolvedValue({
        content: '这是最终答案',
        toolCalls: undefined,
      });

      const result = await agentExecutor.execute(singleConfig, '你好');

      expect(result.success).toBe(true);
      expect(result.result).toBe('这是最终答案');
      expect(result.iterations).toBe(1);
      expect(mockInvocationService.invoke).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'qwen-turbo' }),
        expect.objectContaining({ callType: 'agent' }),
      );
    });

    it('should execute tool calls and return final answer', async () => {
      // 第一次调用返回工具调用
      mockInvocationService.invoke.mockResolvedValueOnce({
        content: '',
        toolCalls: [
          { id: 'call_1', name: 'tool_calculator', arguments: { expression: '1+1' } },
        ],
      });
      // 第二次调用返回最终答案
      mockInvocationService.invoke.mockResolvedValueOnce({
        content: '1+1=2',
        toolCalls: undefined,
      });

      mockSkillService.executeSkill.mockResolvedValue({ result: 2 });

      const result = await agentExecutor.execute(singleConfig, '计算1+1');

      expect(result.success).toBe(true);
      expect(result.toolCallCount).toBe(1);
      expect(result.iterations).toBe(2);
      expect(mockInvocationService.invoke).toHaveBeenCalledTimes(2);
      expect(mockSkillService.executeSkill).toHaveBeenCalledWith(
        'calculator',
        { expression: '1+1' },
      );

      const secondRoundMessages = mockInvocationService.invoke.mock.calls[1][0].messages;
      expect(secondRoundMessages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'assistant',
            toolCalls: [
              expect.objectContaining({ id: 'call_1', name: 'tool_calculator' }),
            ],
          }),
          expect.objectContaining({ role: 'tool', toolCallId: 'call_1' }),
        ]),
      );
    });

    it('should stop at max iterations', async () => {
      mockInvocationService.invoke.mockResolvedValue({
        content: '',
        toolCalls: [
          { id: 'call_1', name: 'tool_calculator', arguments: { expression: 'loop' } },
        ],
      });

      const limitedConfig = { ...singleConfig, maxIterations: 3 };
      mockSkillService.executeSkill.mockResolvedValue({ result: 'looping' });

      const result = await agentExecutor.execute(limitedConfig, '无限循环');

      expect(result.iterations).toBe(3);
      expect(result.success).toBe(true); // 不会报错，只是达到上限
    });

    it('should produce execution trace', async () => {
      mockInvocationService.invoke.mockResolvedValue({
        content: '答案',
        toolCalls: undefined,
      });

      const result = await agentExecutor.execute(singleConfig, '测试');

      expect(result.trace.length).toBeGreaterThan(0);
      expect(result.trace.some((t: any) => t.type === 'thinking')).toBe(true);
      expect(result.trace.some((t: any) => t.type === 'final_answer')).toBe(true);
    });
  });

  // ============================================================
  // Supervisor Agent
  // ============================================================

  describe('Supervisor Agent', () => {
    const supervisorConfig: AgentNodeConfig = {
      mode: 'supervisor',
      strategy: 'react',
      maxIterations: 15,
      memoryEnabled: false,
      memoryWindowSize: 10,
      supervisor: {
        systemPrompt: '你是协调者',
        model: 'qwen-turbo',
        temperature: 0.7,
        maxIterations: 15,
        workers: [
          {
            id: 'worker_1',
            name: '搜索专家',
            description: '负责搜索信息',
            systemPrompt: '你是搜索专家',
            model: 'qwen-turbo',
            temperature: 0.7,
            maxTokens: 2048,
            toolIds: [],
            knowledgeBaseIds: [],
            ragEnabled: false,
          },
        ],
      },
    };

    it('should delegate to worker and return final answer', async () => {
      // Supervisor 委派给 Worker
      mockInvocationService.invoke.mockResolvedValueOnce({
        content: '',
        toolCalls: [
          { id: 'call_1', name: 'delegate_to_worker_1', arguments: { task: '搜索信息' } },
        ],
      });
      // Worker 返回答案
      mockInvocationService.invoke.mockResolvedValueOnce({
        content: '搜索结果: XXX',
        toolCalls: undefined,
      });
      // Supervisor 给出最终答案
      mockInvocationService.invoke.mockResolvedValueOnce({
        content: '',
        toolCalls: [
          { id: 'call_2', name: 'finish', arguments: { answer: '最终答案' } },
        ],
      });

      const result = await agentExecutor.execute(supervisorConfig, '帮我搜索');

      expect(result.success).toBe(true);
      expect(result.result).toBe('最终答案');
      expect(mockInvocationService.invoke).toHaveBeenCalledTimes(3);
      expect(mockInvocationService.invoke.mock.calls[2][0].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'tool', toolCallId: 'call_1' }),
        ]),
      );
    });
  });

  // ============================================================
  // RAG 集成
  // ============================================================

  describe('RAG Integration', () => {
    const ragConfig: AgentNodeConfig = {
      mode: 'single',
      strategy: 'react',
      maxIterations: 10,
      memoryEnabled: false,
      memoryWindowSize: 10,
      singleAgent: {
        id: 'rag_agent',
        name: 'RAG 助手',
        description: '带知识库的助手',
        systemPrompt: '你是知识库助手。',
        model: 'qwen-turbo',
        temperature: 0.7,
        maxTokens: 2048,
        toolIds: [],
        knowledgeBaseIds: ['kb_001'],
        ragEnabled: true,
      },
    };

    it('should enrich context with RAG results', async () => {
      mockRAGService.retrieve.mockResolvedValue([
        { content: '知识库内容1', score: 0.95, metadata: {} },
        { content: '知识库内容2', score: 0.85, metadata: {} },
      ]);

      mockInvocationService.invoke.mockResolvedValue({
        content: '基于知识库的回答',
        toolCalls: undefined,
      });

      const result = await agentExecutor.execute(ragConfig, '查询知识');

      expect(result.ragCallCount).toBe(1);
      expect(mockRAGService.retrieve).toHaveBeenCalledWith('查询知识', 'kb_001', 5);
    });

    it('should handle RAG retrieval failure gracefully', async () => {
      mockRAGService.retrieve.mockRejectedValue(new Error('知识库不存在'));

      mockInvocationService.invoke.mockResolvedValue({
        content: '无法获取知识库信息',
        toolCalls: undefined,
      });

      const failConfig = {
        ...ragConfig,
        singleAgent: { ...ragConfig.singleAgent!, knowledgeBaseIds: ['kb_404'] },
      };

      const result = await agentExecutor.execute(failConfig, '查询');

      expect(result.success).toBe(true);
      expect(result.ragCallCount).toBe(0);
    });
  });

  // ============================================================
  // 错误处理
  // ============================================================

  describe('Error Handling', () => {
    it('should handle LLM API failure', async () => {
      mockInvocationService.invoke.mockRejectedValue(new Error('API 限流'));

      const config: AgentNodeConfig = {
        mode: 'single',
        strategy: 'react',
        maxIterations: 10,
        memoryEnabled: false,
        memoryWindowSize: 10,
        singleAgent: {
          id: 'err_agent',
          name: '错误助手',
          description: '',
          systemPrompt: '',
          model: 'qwen-turbo',
          temperature: 0.7,
          maxTokens: 2048,
          toolIds: [],
          knowledgeBaseIds: [],
          ragEnabled: false,
        },
      };

      const result = await agentExecutor.execute(config, '触发错误');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API 限流');
    });

    it('should handle tool execution failure', async () => {
      mockInvocationService.invoke.mockResolvedValueOnce({
        content: '',
        toolCalls: [
          { id: 'call_1', name: 'tool_calculator', arguments: { expression: 'bad' } },
        ],
      });

      mockSkillService.executeSkill.mockRejectedValue(new Error('工具执行失败'));

      mockInvocationService.invoke.mockResolvedValueOnce({
        content: '工具调用失败了',
        toolCalls: undefined,
      });

      const config: AgentNodeConfig = {
        mode: 'single',
        strategy: 'react',
        maxIterations: 10,
        memoryEnabled: false,
        memoryWindowSize: 10,
        singleAgent: {
          id: 'tool_err_agent',
          name: '工具错误助手',
          description: '',
          systemPrompt: '',
          model: 'qwen-turbo',
          temperature: 0.7,
          maxTokens: 2048,
          toolIds: [],
          knowledgeBaseIds: [],
          ragEnabled: false,
        },
      };

      const result = await agentExecutor.execute(config, '调用坏工具');

      expect(result.success).toBe(true);
      expect(result.toolCallCount).toBe(1);
    });
  });

  // ============================================================
  // 统一模型调用
  // ============================================================

  describe('Unified LLM invocation', () => {
    it('should pass the selected model to the invocation service', async () => {
      mockInvocationService.invoke.mockResolvedValue({
        content: 'GPT-4o 回答',
        toolCalls: undefined,
      });

      const config: AgentNodeConfig = {
        mode: 'single',
        strategy: 'react',
        maxIterations: 10,
        memoryEnabled: false,
        memoryWindowSize: 10,
        singleAgent: {
          id: 'gpt_agent',
          name: 'GPT 助手',
          description: '',
          systemPrompt: '',
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 2048,
          toolIds: [],
          knowledgeBaseIds: [],
          ragEnabled: false,
        },
      };

      const result = await agentExecutor.execute(config, '你好');

      expect(mockInvocationService.invoke).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o' }),
        expect.objectContaining({ callType: 'agent' }),
      );
      expect(result.success).toBe(true);
    });
  });
});
