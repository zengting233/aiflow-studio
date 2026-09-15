import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AppShareService } from '../services/app-share.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { IsOptional, IsBoolean, IsObject } from 'class-validator';
import {
  CircuitBreakerService,
  DEFAULT_RATE_LIMITS,
  RateLimiterService,
} from '../../../common/guards/rate-limit.guard';

class UpdateShareSettingsDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  embedConfig?: {
    allowedOrigins?: string[];
    theme?: string;
  };
}

class RunSharedAppDto {
  @IsObject({ message: '输入参数必须是对象' })
  inputs: Record<string, unknown>;
}

@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppShareController {
  constructor(private readonly appShareService: AppShareService) {}

  /**
   * 生成分享链接
   */
  @Post(':appId/share')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  generateShareLink(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
  ) {
    return this.appShareService.generateShareLink(userId, appId);
  }

  /**
   * 更新分享设置
   */
  @Patch(':appId/share')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  updateShareSettings(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
    @Body() dto: UpdateShareSettingsDto,
  ) {
    return this.appShareService.updateShareSettings(userId, appId, dto);
  }

  /**
   * 撤销分享链接
   */
  @Delete(':appId/share')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  revokeShareLink(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
  ) {
    return this.appShareService.revokeShareLink(userId, appId);
  }

  /**
   * 获取嵌入代码
   */
  @Get(':appId/embed')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  getEmbedCode(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
  ) {
    return this.appShareService.getEmbedCode(userId, appId);
  }
}

/**
 * 公开分享链接访问（无需认证）
 */
@Controller('share')
export class AppSharePublicController {
  constructor(
    private readonly appShareService: AppShareService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  @Get(':shareLink')
  getSharedApp(@Param('shareLink') shareLink: string) {
    return this.appShareService.getSharedApp(shareLink);
  }

  @Post(':shareLink/run')
  async runSharedApp(
    @Param('shareLink') shareLink: string,
    @Body() dto: RunSharedAppDto,
    @Req() request: Request,
  ) {
    const config = DEFAULT_RATE_LIMITS['workflow:run'];
    const visitorKey = `rate_limit:share:${shareLink}:${request.ip || 'unknown'}`;
    const rateLimit = await this.rateLimiterService.checkRateLimit(visitorKey, config);
    if (!rateLimit.allowed) {
      throw new HttpException('请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }

    const concurrentKey = `concurrent:share:${shareLink}`;
    const concurrent = await this.rateLimiterService.acquireConcurrent(
      concurrentKey,
      config.maxConcurrent || 0,
    );
    if (!concurrent.allowed) {
      throw new HttpException('当前使用人数较多，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }

    const circuitAllowed = await this.circuitBreakerService.isAllowed('workflow');
    if (!circuitAllowed) {
      await this.rateLimiterService.releaseConcurrent(concurrentKey);
      throw new HttpException('应用暂时不可用，请稍后再试', HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      const result = await this.appShareService.runSharedApp(shareLink, dto.inputs);
      await this.circuitBreakerService.recordSuccess('workflow');
      return result;
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 500;
      if (status >= 500) await this.circuitBreakerService.recordFailure('workflow');
      throw error;
    } finally {
      await this.rateLimiterService.releaseConcurrent(concurrentKey);
    }
  }
}
