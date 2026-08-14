import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { StoriesService } from './stories.service';

@Controller('stories')
@UseGuards(SupabaseAuthGuard)
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  // GET /api/v1/stories?topic= — 이야기 목록 (published만)
  @Get()
  list(@Query('topic') topic?: string) {
    return this.stories.listPublished(topic);
  }

  // GET /api/v1/stories/:storyId — 이야기 상세
  @Get(':storyId')
  detail(@Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.stories.detail(storyId);
  }
}
