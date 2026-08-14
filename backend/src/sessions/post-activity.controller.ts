import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PostActivityService } from './post-activity.service';

@Controller('sessions/:sessionId/post-activity')
@UseGuards(SupabaseAuthGuard)
export class PostActivityController {
  constructor(private readonly postActivity: PostActivityService) {}

  // GET — 카드 목록 (서버가 무작위로 섞어 반환, 정답 순서는 미포함)
  @Get()
  cards(@Req() req: { parentId: string }, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.postActivity.getShuffledCards(req.parentId, sessionId);
  }

  // POST /order — 카드 순서 제출 → 서버 판정
  @Post('order')
  submitOrder(
    @Req() req: { parentId: string },
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: { submittedOrder: string[] },
  ) {
    return this.postActivity.judgeOrder(req.parentId, sessionId, dto.submittedOrder);
  }

  // POST /retelling — 재구성 발화 제출 → 세션 완료
  @Post('retelling')
  submitRetelling(
    @Req() req: { parentId: string },
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: { text: string },
  ) {
    return this.postActivity.completeRetelling(req.parentId, sessionId, dto.text);
  }
}
