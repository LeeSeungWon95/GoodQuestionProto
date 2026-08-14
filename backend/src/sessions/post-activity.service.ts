import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// stories.post_activity_config의 JSON 구조 (팀 DB안)
interface PostActivityConfig {
  cards: { id: string; text: string; correct_order: number }[];
  retelling_keywords: string[];
}

@Injectable()
export class PostActivityService {
  constructor(private readonly prisma: PrismaService) {}

  // 세션 조회 + 소유권 검증 + 후속 활동 단계인지 확인 + 카드 설정 로드
  private async loadForActivity(parentId: string, sessionId: string) {
    const session = await this.prisma.storySession.findUnique({
      where: { id: sessionId },
      include: { child: true, story: true },
    });
    if (!session) throw new NotFoundException('NOT_FOUND');
    if (session.child.parentId !== parentId) throw new ForbiddenException('FORBIDDEN');
    if (session.status !== 'post_activity') throw new ConflictException('SESSION_STATE');

    const config = session.story.postActivityConfig as unknown as PostActivityConfig | null;
    if (!config?.cards?.length) throw new NotFoundException('NOT_FOUND');
    return { session, config };
  }

  // 카드 목록 — 서버가 무작위로 섞어 반환. 정답 순서(correct_order)는 절대 내려주지 않는다.
  async getShuffledCards(parentId: string, sessionId: string) {
    const { config } = await this.loadForActivity(parentId, sessionId);

    const cards = config.cards.map((c) => ({ id: c.id, text: c.text }));
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return { cards };
  }

  // 순서 판정 — 정답 여부는 서버가 계산한다 (팀 DB안 규칙)
  async judgeOrder(parentId: string, sessionId: string, submittedOrder: string[]) {
    const { config } = await this.loadForActivity(parentId, sessionId);

    const answer = [...config.cards]
      .sort((a, b) => a.correct_order - b.correct_order)
      .map((c) => c.id);
    const correct =
      submittedOrder.length === answer.length &&
      submittedOrder.every((id, i) => id === answer[i]);

    // 세션당 결과 1건 — 시도할 때마다 attempt_count 증가 (시도별 과정은 저장 안 함)
    const result = await this.prisma.postActivityResult.upsert({
      where: { sessionId },
      update: { submittedOrder, isOrderCorrect: correct, attemptCount: { increment: 1 } },
      create: { sessionId, submittedOrder, isOrderCorrect: correct, attemptCount: 1 },
    });

    if (correct) {
      // 정답일 때만 핵심 단어 공개 (FR-07: 배열 정답 시 핵심 단어 3~4개 제공)
      return { correct: true, retellingKeywords: config.retelling_keywords };
    }
    return { correct: false, attemptCount: result.attemptCount };
  }

  // 재구성 발화 저장 → 세션 완료
  async completeRetelling(parentId: string, sessionId: string, text: string) {
    await this.loadForActivity(parentId, sessionId);

    await this.prisma.postActivityResult.update({
      where: { sessionId },
      data: { retellingText: text, completedAt: new Date() },
    });
    await this.prisma.storySession.update({
      where: { id: sessionId },
      data: { status: 'completed', completedAt: new Date(), lastActivityAt: new Date() },
    });
    return { completed: true };
  }
}
