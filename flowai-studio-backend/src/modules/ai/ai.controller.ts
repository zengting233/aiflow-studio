import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { WorkflowService } from '../workflow/workflow.service';
import { StreamRunDto, RunDto, ChatDto } from './dto/ai.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('ai')
export class AiController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly chatService: ChatService,
  ) {}

  @Post('run')
  @UseGuards(JwtAuthGuard)
  async run(
    @CurrentUser('userId') userId: string,
    @Body() runDto: RunDto,
  ) {
    return this.workflowService.run(userId, runDto);
  }

  @Post('stream-run')
  @UseGuards(JwtAuthGuard)
  async streamRun(
    @CurrentUser('userId') userId: string,
    @Body() streamRunDto: StreamRunDto,
    @Res() res: Response,
  ) {
    await this.workflowService.streamRun(userId, streamRunDto, res);
  }

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @CurrentUser('userId') userId: string,
    @Body() chatDto: ChatDto,
    @Res() res: Response,
  ) {
    await this.chatService.chat(userId, chatDto, res);
  }

  @Get('chat-histories/:sessionId')
  @UseGuards(JwtAuthGuard)
  async getChatHistory(
    @CurrentUser('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.chatService.getChatHistory(userId, sessionId);
  }

  @Get('chat-histories')
  @UseGuards(JwtAuthGuard)
  async getAllChatHistories(
    @CurrentUser('userId') userId: string,
    @Query('appId') appId?: string,
  ) {
    return this.chatService.getAllChatHistories(userId, appId);
  }
}
