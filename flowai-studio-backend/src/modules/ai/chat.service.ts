import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../common/services/prisma.service';
import { RAGService } from '../rag/services/rag.service';
import { LLMProviderFactory } from '../agent/providers/llm-provider.factory';
import { LLMMessage } from '../agent/interfaces/llm-provider.interface';
import { ChatDto } from './dto/ai.dto';

const DEFAULT_CHAT_MODEL = 'qwen-turbo';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RAGService,
    private readonly providerFactory: LLMProviderFactory,
  ) {}

  async chat(userId: string, chatDto: ChatDto, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const {
        message,
        history = [],
        sessionId = Date.now().toString(),
        knowledgeBaseId,
        model = DEFAULT_CHAT_MODEL,
      } = chatDto;

      this.prisma.chatHistory
        .create({ data: { sessionId, role: 'user', content: message, userId } })
        .catch((error) =>
          console.error('保存用户消息失败:', error.message),
        );

      let context = '';
      let references: any[] = [];
      if (knowledgeBaseId) {
        try {
          references = await this.ragService.retrieve(
            message,
            knowledgeBaseId,
            5,
          );
          context = references.map((reference) => reference.content).join('\n\n');
        } catch (error) {
          console.error(
            'RAG 检索失败，降级为普通对话:',
            error instanceof Error ? error.message : error,
          );
        }
      }

      const messages: LLMMessage[] = [];
      if (context) {
        messages.push({
          role: 'system',
          content: `你是一个基于知识库回答问题的助手。请参考以下内容回答：\n\n${context}`,
        });
      }
      messages.push(...history, { role: 'user', content: message });

      const provider = this.providerFactory.getProviderForModel(model);
      let fullAssistantContent = '';
      for await (const content of provider.chatStream({
        model,
        messages,
      })) {
        fullAssistantContent += content;
        res.write(`data: ${JSON.stringify({ type: 'text', content })}\n\n`);
      }

      this.prisma.chatHistory
        .create({
          data: {
            sessionId,
            role: 'assistant',
            content: fullAssistantContent,
            userId,
            references: JSON.stringify(references),
          },
        })
        .catch((error) =>
          console.error('保存助手消息失败:', error.message),
        );

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error) {
      const safeMessage = (
        error instanceof Error ? error.message : 'Unknown error'
      ).replace(/[\n\r]/g, ' ');
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: safeMessage })}\n\n`,
      );
      res.end();
    }
  }

  async getChatHistory(userId: string, sessionId: string) {
    return this.prisma.chatHistory.findMany({
      where: { sessionId, userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        references: true,
        toolCalls: true,
        createdAt: true,
      },
    });
  }

  async getAllChatHistories(userId: string, appId?: string) {
    const where: {
      userId: string;
      metadata?: { path: string[]; equals: string };
    } = { userId };
    if (appId) where.metadata = { path: ['appId'], equals: appId };

    const histories = await this.prisma.chatHistory.groupBy({
      by: ['sessionId'],
      where,
      _max: { createdAt: true },
    });

    return histories.map((history: any) => ({
      sessionId: history.sessionId,
      lastMessageAt: history._max.createdAt,
    }));
  }
}
