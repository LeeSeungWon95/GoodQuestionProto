import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(topic?: string) {
    const stories = await this.prisma.story.findMany({
      where: { status: 'published', ...(topic ? { topics: { has: topic } } : {}) },
    });
    return {
      stories: stories.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        thumbnailUrl: s.thumbnailUrl,
        topics: s.topics,
        difficulty: s.difficulty,
        estimatedMinutes: s.estimatedMinutes,
      })),
    };
  }

  async detail(storyId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { _count: { select: { scenes: true } } },
    });
    if (!story || story.status !== 'published') throw new NotFoundException('NOT_FOUND');
    return {
      id: story.id,
      title: story.title,
      summary: story.summary,
      topics: story.topics,
      difficulty: story.difficulty,
      estimatedMinutes: story.estimatedMinutes,
      sceneCount: story._count.scenes,
    };
  }
}
