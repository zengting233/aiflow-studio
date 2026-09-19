import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { ChatService } from './chat.service';
import { RAGModule } from '../rag/rag.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { PrismaModule } from '../../common/modules/prisma.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [PrismaModule, RAGModule, WorkflowModule, AgentModule],
  controllers: [AiController],
  providers: [ChatService],
})
export class AiModule {}
