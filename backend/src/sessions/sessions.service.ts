import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DialogueEngineService } from './dialogue-engine.service';
import { SubmitUtteranceDto } from './dto/submit-utterance.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: DialogueEngineService,
  ) {}

  // 소유권 검증: 이 아이가 요청한 보호자의 아이인지
  private async assertOwnership(parentId: string, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException('NOT_FOUND');
    if (child.parentId !== parentId) throw new ForbiddenException('FORBIDDEN');
    return child;
  }

  // 세션 조회 + 소유권 검증 (세션 경유 접근용)
  private async loadOwnedSession(parentId: string, sessionId: string) {
    const session = await this.prisma.storySession.findUnique({
      where: { id: sessionId },
      include: { child: true, currentScene: true },
    });
    if (!session) throw new NotFoundException('NOT_FOUND');
    if (session.child.parentId !== parentId) throw new ForbiddenException('FORBIDDEN');
    return session;
  }

  async findActive(parentId: string, childId: string) {
    await this.assertOwnership(parentId, childId);
    const session = await this.prisma.storySession.findFirst({
      where: { childId, status: { in: ['in_progress', 'post_activity'] } },
      orderBy: { lastActivityAt: 'desc' },
      include: { story: true },
    });
    if (!session) return { session: null };
    return {
      session: {
        id: session.id,
        storyId: session.storyId,
        storyTitle: session.story.title,
        status: session.status,
        lastActivityAt: session.lastActivityAt,
      },
    };
  }

  async start(parentId: string, childId: string, storyId: string) {
    await this.assertOwnership(parentId, childId);

    // 동의 검증 — 동의 없거나 철회된 아이는 세션 시작 불가 (팀 DB안 규칙)
    const consent = await this.prisma.childConsent.findFirst({
      where: { childId, withdrawnAt: null },
    });
    if (!consent) throw new ForbiddenException('CONSENT_REQUIRED');

    // 같은 이야기의 미완료 세션이 있으면 새로 만들지 않고 이어한다
    // (in_progress → 하던 장면부터 / post_activity → 후속 활동부터)
    const existing = await this.prisma.storySession.findFirst({
      where: { childId, storyId, status: { in: ['in_progress', 'post_activity'] } },
      include: { currentScene: true },
    });
    if (existing?.status === 'post_activity') {
      return { sessionId: existing.id, resumed: true, status: 'post_activity', scene: null };
    }
    if (existing?.currentScene) {
      return {
        sessionId: existing.id,
        resumed: true,
        status: 'in_progress',
        scene: await this.buildSceneView(existing.id, existing.currentScene, existing),
      };
    }

    const firstScene = await this.prisma.storyScene.findFirst({
      where: { storyId },
      orderBy: { sceneOrder: 'asc' },
    });
    if (!firstScene) throw new NotFoundException('NOT_FOUND');

    const session = await this.prisma.storySession.create({
      data: { childId, storyId, currentSceneId: firstScene.id },
    });
    return {
      sessionId: session.id,
      resumed: false,
      status: 'in_progress',
      scene: await this.buildSceneView(session.id, firstScene, session),
    };
  }

  async detail(parentId: string, sessionId: string) {
    const session = await this.loadOwnedSession(parentId, sessionId);
    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { turnOrder: 'asc' },
    });
    return {
      sessionId: session.id,
      status: session.status,
      storyId: session.storyId,
      scene: session.currentScene
        ? await this.buildSceneView(session.id, session.currentScene, session)
        : null,
      messages: messages.map((m) => ({
        id: m.id,
        speakerType: m.speakerType,
        text: m.text,
      })),
    };
  }

  // 도입/전개 재생 완료(또는 임시로 대화 건너뛰기) → 다음 장면으로 이동
  async advanceScene(parentId: string, sessionId: string) {
    const session = await this.loadOwnedSession(parentId, sessionId);
    if (session.status !== 'in_progress') throw new ConflictException('SESSION_STATE');

    const next = await this.prisma.storyScene.findFirst({
      where: {
        storyId: session.storyId,
        sceneOrder: { gt: session.currentScene?.sceneOrder ?? 0 },
      },
      orderBy: { sceneOrder: 'asc' },
    });

    // 다음 장면이 없다 = 이야기 완료 → 말하기 후 활동 단계로 전환
    if (!next) {
      await this.prisma.storySession.update({
        where: { id: sessionId },
        data: { status: 'post_activity', lastActivityAt: new Date() },
      });
      return { scene: null, storyComplete: true };
    }

    // 새 장면 진입: 장면 단위 상태 초기화 (누적 요소·턴 카운트는 장면 스코프 — 팀 DB안)
    const updated = await this.prisma.storySession.update({
      where: { id: sessionId },
      data: {
        currentSceneId: next.id,
        currentChildTurnCount: 0,
        accumulatedElements: [],
        lastDetectedElements: [],
        lastResponseMode: null,
        lastGuidanceTarget: null,
        turnsWithoutNewElement: 0,
        consecutiveLowInformationTurns: 0,
        sceneGoalMet: false,
        sceneEndReason: null,
        lastActivityAt: new Date(),
      },
    });

    return {
      scene: await this.buildSceneView(sessionId, next, updated),
      storyComplete: false,
    };
  }

  // SceneView 조립. 대화 장면 진입 시 고정 첫 대사를 messages에 기록하고 함께 반환한다.
  // (엔진 규칙 8단계 중 1단계: "고정 첫 대사 불러오기·저장·TTS")
  private async buildSceneView(
    sessionId: string,
    scene: NonNullable<Awaited<ReturnType<PrismaService['storyScene']['findFirst']>>>,
    session: { currentChildTurnCount: number },
  ) {
    let characterMessage: { messageId: string; text: string; audioUrl: string } | null = null;

    if (scene.sceneType === 'dialogue' && scene.characterOpening) {
      // 같은 장면의 첫 대사를 중복 기록하지 않도록 확인 (이어하기·재조회 대비)
      const already = await this.prisma.message.findFirst({
        where: { sessionId, sceneId: scene.id, speakerType: 'character', text: scene.characterOpening },
      });
      const msg =
        already ??
        (await this.prisma.message.create({
          data: {
            sessionId,
            sceneId: scene.id,
            speakerType: 'character',
            turnOrder: (await this.prisma.message.count({ where: { sessionId } })) + 1,
            text: scene.characterOpening,
          },
        }));
      characterMessage = {
        messageId: msg.id,
        text: msg.text,
        audioUrl: `/api/v1/speech/tts/${msg.id}`, // TTS 구현 전까지 프론트는 텍스트만 표시
      };
    }

    return { ...this.engine.toSceneView(scene, session), characterMessage };
  }

  // 핵심 턴 파이프라인 (docs/06-dialogue-engine.md 8단계 중 4~8)
  // 저장 → 분석 → 서버 규칙 판정 → 캐릭터 응답(생성 또는 고정 마지막 대사) → 세션 갱신
  async submitUtterance(parentId: string, sessionId: string, dto: SubmitUtteranceDto) {
    const session = await this.loadOwnedSession(parentId, sessionId);
    const scene = session.currentScene;
    if (session.status !== 'in_progress' || scene?.sceneType !== 'dialogue') {
      throw new ConflictException('SESSION_STATE');
    }

    // 4단계: 확정된 아이 발화 저장
    const childMsg = await this.prisma.message.create({
      data: {
        sessionId,
        sceneId: scene.id,
        speakerType: 'child',
        turnOrder: (await this.prisma.message.count({ where: { sessionId } })) + 1,
        text: dto.text,
        sttRawText: dto.sttRawText,
      },
    });

    // 5단계: 발화 분석 (현재 mock — OpenAI 연동 시 내용만 교체)
    const lastCharacterMsg = await this.prisma.message.findFirst({
      where: { sessionId, sceneId: scene.id, speakerType: 'character' },
      orderBy: { turnOrder: 'desc' },
    });
    const analysis = await this.engine.analyze({
      sceneContext: [scene.sceneDescription, scene.conflict].filter(Boolean).join(' '),
      previousCharacterMessage: lastCharacterMsg?.text ?? null,
      childUtterance: dto.text,
      targetElements: scene.requiredElements,
    });

    // 후처리 (원문 규칙): evidence가 발화 원문에 없으면 해당 요소 폐기
    analysis.detectedElements = analysis.detectedElements.filter((e) =>
      dto.text.includes(e.evidence),
    );

    await this.prisma.utteranceAnalysis.create({
      data: {
        messageId: childMsg.id,
        childIntent: analysis.childIntent,
        mainPoint: analysis.mainPoint,
        detectedElements: analysis.detectedElements,
        utteranceValidity: analysis.utteranceValidity,
      },
    });

    // 6단계: 서버 규칙 판정 — 요소 누적·모드 결정 (LLM이 아니라 규칙이 확정)
    const decision = this.engine.decideMode({ scene, session, analysis });
    const turnCount = session.currentChildTurnCount + 1;

    // 세션 상태 갱신 (팀 DB안의 카운터들)
    await this.prisma.storySession.update({
      where: { id: sessionId },
      data: {
        currentChildTurnCount: turnCount,
        accumulatedElements: decision.accumulatedElements,
        lastDetectedElements: analysis.detectedElements.map((e) => e.type),
        lastResponseMode: decision.mode,
        lastGuidanceTarget: decision.guidanceTarget,
        turnsWithoutNewElement: decision.nextTurnsWithoutNewElement,
        consecutiveLowInformationTurns: decision.nextConsecutiveLowInfoTurns,
        sceneGoalMet: decision.endReason === 'GOAL_MET',
        sceneEndReason: decision.endReason,
        lastActivityAt: new Date(),
      },
    });

    // 7단계: 캐릭터 응답 — CLOSING이면 생성 없이 고정 마지막 대사 조회 (D-13)
    const replyText =
      decision.mode === 'CLOSING'
        ? (scene.characterClosing ?? '오늘 이야기 나눠줘서 고마워.')
        : await this.engine.generateCharacterReply({
            mode: decision.mode,
            guidanceTarget: decision.guidanceTarget,
            missingElements: decision.missingElements,
            analysis,
            characterName: scene.characterName,
          });

    // 8단계: 응답 저장
    const characterMsg = await this.prisma.message.create({
      data: {
        sessionId,
        sceneId: scene.id,
        speakerType: 'character',
        turnOrder: (await this.prisma.message.count({ where: { sessionId } })) + 1,
        text: replyText,
      },
    });

    const common = {
      childMessage: { messageId: childMsg.id, text: childMsg.text },
      characterMessage: {
        messageId: characterMsg.id,
        text: characterMsg.text,
        audioUrl: `/api/v1/speech/tts/${characterMsg.id}`,
      },
      missionTrigger: null, // Q-06 확정 후 구현
    };

    if (decision.mode === 'CLOSING') {
      // 마지막 장면인지 확인 → 마지막이면 서버가 직접 후속 활동 단계로 전환
      // (요건: "마지막 장면 완료 후 말하기 후 활동으로 전환한다")
      const nextScene = await this.prisma.storyScene.findFirst({
        where: { storyId: session.storyId, sceneOrder: { gt: scene.sceneOrder } },
      });
      if (!nextScene) {
        await this.prisma.storySession.update({
          where: { id: sessionId },
          data: { status: 'post_activity', lastActivityAt: new Date() },
        });
      }
      return {
        ...common,
        sceneStatus: 'closed' as const,
        endReason: decision.endReason,
        isStoryComplete: !nextScene,
      };
    }
    return {
      ...common,
      sceneStatus: 'continue' as const,
      turn: { current: turnCount, max: scene.maxTurns },
    };
  }

  async stop(parentId: string, sessionId: string) {
    const session = await this.loadOwnedSession(parentId, sessionId);
    await this.prisma.storySession.update({
      where: { id: session.id },
      data: { status: 'stopped', lastActivityAt: new Date() },
    });
    return { stopped: true };
  }
}
