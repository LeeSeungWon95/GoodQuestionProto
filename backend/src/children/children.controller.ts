import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';

@Controller('children')
@UseGuards(SupabaseAuthGuard)
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}

  // GET /api/v1/children — 아이 선택 화면
  @Get()
  list(@Req() req: { parentId: string }) {
    return this.children.listByParent(req.parentId);
  }

  // POST /api/v1/children — 아이 등록 + 동의 기록 (트랜잭션)
  @Post()
  create(
    @Req() req: { parentId: string; parentEmail?: string },
    @Body() dto: CreateChildDto,
  ) {
    return this.children.createWithConsent(req.parentId, req.parentEmail, dto);
  }

  // DELETE /api/v1/children/:childId — 아이와 모든 학습 기록 삭제
  @Delete(':childId')
  remove(@Req() req: { parentId: string }, @Param('childId', ParseUUIDPipe) childId: string) {
    return this.children.remove(req.parentId, childId);
  }
}
