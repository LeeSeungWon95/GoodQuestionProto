import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SubmitUtteranceDto } from './dto/submit-utterance.dto';
import { SessionsService } from './sessions.service';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  // GET /api/v1/children/:childId/active-session — 이어하기
  @Get('children/:childId/active-session')
  activeSession(@Req() req: { parentId: string }, @Param('childId', ParseUUIDPipe) childId: string) {
    return this.sessions.findActive(req.parentId, childId);
  }

  // POST /api/v1/sessions — 세션 시작 (동의 검증 포함)
  // restart: true면 미완료 세션을 중단 처리하고 처음부터 새로 시작
  @Post('sessions')
  start(
    @Req() req: { parentId: string },
    @Body() dto: { childId: string; storyId: string; restart?: boolean },
  ) {
    return this.sessions.start(req.parentId, dto.childId, dto.storyId, dto.restart ?? false);
  }

  // GET /api/v1/sessions/:sessionId — 세션 상태 복원
  @Get('sessions/:sessionId')
  detail(@Req() req: { parentId: string }, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.sessions.detail(req.parentId, sessionId);
  }

  // POST /api/v1/sessions/:sessionId/scene-advance — 도입/전개 완료 → 다음 장면
  @Post('sessions/:sessionId/scene-advance')
  advance(@Req() req: { parentId: string }, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.sessions.advanceScene(req.parentId, sessionId);
  }

  // POST /api/v1/sessions/:sessionId/messages — 발화 확정 제출 (핵심 턴 처리)
  @Post('sessions/:sessionId/messages')
  submitUtterance(
    @Req() req: { parentId: string },
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SubmitUtteranceDto,
  ) {
    return this.sessions.submitUtterance(req.parentId, sessionId, dto);
  }

  // POST /api/v1/sessions/:sessionId/stop — 세션 중단
  @Post('sessions/:sessionId/stop')
  stop(@Req() req: { parentId: string }, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.sessions.stop(req.parentId, sessionId);
  }
}
