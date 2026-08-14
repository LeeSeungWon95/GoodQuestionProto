import { Injectable } from '@nestjs/common';
import { StoryScene, StorySession } from '../../generated/prisma/client';

// 대화 엔진 — docs/06-dialogue-engine.md 요약 및 원문 「대화작동규칙_260803_수정안」 기준.
// 구현 경계 3분리: 분석 LLM(구조화만) / 서버 규칙(이 파일, 판정) / 캐릭터 LLM(대사 생성만)
//
// ⚠️ 현재 analyze()와 generateCharacterReply()는 OpenAI 키 없이 동작하는 **가짜(mock)** 구현.
//    키 확보 후 이 두 함수의 내용만 OpenAI 호출로 교체하면 된다 (다른 코드는 무변경).

export type ResponseMode = 'NORMAL' | 'GUIDED' | 'CLOSING';
export type EndReason = 'GOAL_MET' | 'MAX_TURNS' | null;

export interface AnalysisResult {
  childIntent: string;
  mainPoint: string | null;
  detectedElements: { type: string; evidence: string }[];
  utteranceValidity: 'VALID' | 'SHORT' | 'UNCLEAR' | 'OFF_TOPIC' | 'PLAYFUL';
}

export interface ModeDecision {
  mode: ResponseMode;
  endReason: EndReason;
  guidanceTarget: string | null;
  accumulatedElements: string[];
  missingElements: string[];
  // 세션에 저장할 다음 카운터 값들 (서버 규칙이 판정하며 함께 계산)
  nextTurnsWithoutNewElement: number;
  nextConsecutiveLowInfoTurns: number;
}

// 가짜 분석기용 사고 요소 판별 사전 — 한국어 단서 패턴 (8종, 팀 규칙 문서의 요소 정의 기준)
const ELEMENT_PATTERNS: { type: string; patterns: RegExp[] }[] = [
  { type: 'REASON', patterns: [/왜냐하면/, /때문/, /니까/, /잖아/] },
  { type: 'SOLUTION', patterns: [/방법/, /하면 되/, /하면 돼/, /해 ?보/, /말해/, /해 ?봐/, /하자/, /도와/, /쓰면/] },
  { type: 'EMOTION', patterns: [/슬퍼/, /슬프/, /기뻐/, /무서/, /속상/, /부끄/, /좋아/, /싫어/, /창피/] },
  { type: 'EMPATHY', patterns: [/불쌍/, /힘들/, /이해/, /마음이/, /안쓰/] },
  { type: 'PERSPECTIVE', patterns: [/라면/, /입장/, /생각에/, /봤을 때/, /것 같/] },
  { type: 'REQUEST', patterns: [/주세요/, /해줘/, /부탁/, /해 주/, /달라/] },
  { type: 'DECISION', patterns: [/할래/, /안 돼/, /안돼/, /해야/, /하기로/] },
  { type: 'RESULT', patterns: [/그러면/, /그럼/, /될 거/, /떨어지/, /생길/] },
];

// GUIDED 유도 질문 틀 — 부족 요소별 (가짜 캐릭터 LLM용)
const GUIDANCE_LINES: Record<string, string> = {
  REASON: '그렇구나. 그런데 왜 그렇게 생각했는지 조금 더 말해줄 수 있어?',
  SOLUTION: '음, 그러면 어떻게 하면 좋을까? 좋은 방법이 떠오르니?',
  EMOTION: '그때 네 마음은 어땠을 것 같아?',
  EMPATHY: '그 사람 마음은 어떨 것 같아?',
  PERSPECTIVE: '만약 네가 그 사람이라면 어떻게 느꼈을 것 같아?',
  REQUEST: '나한테 바라는 게 있다면 말해줄래?',
  DECISION: '너라면 어떻게 하기로 정할 것 같아?',
  RESULT: '그렇게 하면 그다음엔 어떤 일이 생길까?',
};

@Injectable()
export class DialogueEngineService {
  // ── 분석 (지금은 가짜) ─────────────────────────────────────────────
  // 진짜 구현 시 입력 규칙(원문 2.1절): sceneContext, previousCharacterMessage,
  // childUtterance, targetElements만 전달. 누적 요소·턴 수는 넣지 않는다.
  async analyze(input: {
    sceneContext: string;
    previousCharacterMessage: string | null;
    childUtterance: string;
    targetElements: string[];
  }): Promise<AnalysisResult> {
    const text = input.childUtterance.trim();

    // 유효성 판정 (간이)
    let validity: AnalysisResult['utteranceValidity'] = 'VALID';
    if (text.length < 4) validity = 'SHORT';
    else if (/몰라|모르겠/.test(text)) validity = 'UNCLEAR';

    // 사고 요소 검출 — evidence는 반드시 발화 원문 속 실제 문자열 (서버 후처리 규칙 대비)
    const detected: { type: string; evidence: string }[] = [];
    if (validity === 'VALID') {
      for (const { type, patterns } of ELEMENT_PATTERNS) {
        for (const p of patterns) {
          const m = text.match(p);
          if (m) {
            detected.push({ type, evidence: m[0] });
            break;
          }
        }
      }
    }

    const childIntent =
      validity === 'SHORT'
        ? 'SHORT_RESPONSE'
        : validity === 'UNCLEAR'
          ? 'UNCLEAR'
          : text.endsWith('?')
            ? 'QUESTION'
            : detected.some((d) => d.type === 'SOLUTION')
              ? 'SOLUTION'
              : detected.some((d) => d.type === 'REASON')
                ? 'REASONING'
                : 'OPINION';

    return {
      childIntent,
      mainPoint: validity === 'VALID' ? text.slice(0, 60) : null,
      detectedElements: detected,
      utteranceValidity: validity,
    };
  }

  // ── 서버 규칙: 응답 모드 결정 (원문 2.2절 표 — 우선순위 순. 진짜 구현) ──
  decideMode(params: {
    scene: Pick<StoryScene, 'requiredElements' | 'preferredTurns' | 'maxTurns'>;
    session: Pick<
      StorySession,
      | 'accumulatedElements'
      | 'currentChildTurnCount'
      | 'lastResponseMode'
      | 'turnsWithoutNewElement'
      | 'consecutiveLowInformationTurns'
    >;
    analysis: AnalysisResult;
  }): ModeDecision {
    const { scene, session, analysis } = params;

    const newTypes = analysis.detectedElements.map((e) => e.type);
    const accumulated = [...new Set([...session.accumulatedElements, ...newTypes])];
    const missing = (scene.requiredElements ?? []).filter((e) => !accumulated.includes(e));

    const turnCount = session.currentChildTurnCount + 1; // 이번 발화 포함
    const minTurns = scene.preferredTurns ?? 1;
    const maxTurns = scene.maxTurns ?? 6;
    const hasNewElement = newTypes.some((t) => !session.accumulatedElements.includes(t));
    const isFirstUtterance = session.currentChildTurnCount === 0;
    const prevWasGuided = session.lastResponseMode === 'GUIDED';
    const lowInfo = ['SHORT', 'UNCLEAR', 'OFF_TOPIC'].includes(analysis.utteranceValidity);
    const lowInfoStreak = lowInfo ? session.consecutiveLowInformationTurns + 1 : 0;
    const noNewStreak = hasNewElement ? 0 : session.turnsWithoutNewElement + 1;

    const base = {
      accumulatedElements: accumulated,
      missingElements: missing,
      nextTurnsWithoutNewElement: noNewStreak,
      nextConsecutiveLowInfoTurns: lowInfoStreak,
    };

    // 1. 목표 충족 종료
    if (turnCount >= minTurns && missing.length === 0) {
      return { ...base, mode: 'CLOSING', endReason: 'GOAL_MET', guidanceTarget: null };
    }
    // 2. 최대 턴 종료
    if (turnCount >= maxTurns) {
      return { ...base, mode: 'CLOSING', endReason: 'MAX_TURNS', guidanceTarget: null };
    }
    // 3. NORMAL 강제: 첫 발화 / 신규 요소 있음 / 직전 GUIDED
    if (isFirstUtterance || hasNewElement || prevWasGuided) {
      return { ...base, mode: 'NORMAL', endReason: null, guidanceTarget: null };
    }
    // 4. GUIDED: missing 있고, 직전 GUIDED 아님, (저정보 2연속 or 신규 없음 2회 or 남은 턴 ≤ 2)
    const remaining = maxTurns - turnCount;
    if (missing.length > 0 && !prevWasGuided && (lowInfoStreak >= 2 || noNewStreak >= 2 || remaining <= 2)) {
      return { ...base, mode: 'GUIDED', endReason: null, guidanceTarget: missing[0] };
    }
    // 5. 그 외 NORMAL
    return { ...base, mode: 'NORMAL', endReason: null, guidanceTarget: null };
  }

  // ── 캐릭터 대사 생성 (지금은 가짜) ──────────────────────────────────
  // 진짜 구현 시: 캐릭터 성격·반응 원칙 키(reactionKey)·guidanceStyle을 프롬프트로 전달.
  // CLOSING은 이 함수를 타지 않는다 (고정 마지막 대사 조회 — 서비스 쪽에서 처리).
  async generateCharacterReply(input: {
    mode: 'NORMAL' | 'GUIDED';
    guidanceTarget: string | null;
    missingElements: string[];
    analysis: AnalysisResult;
    characterName: string | null;
  }): Promise<string> {
    const { mode, guidanceTarget, missingElements, analysis } = input;

    // 발화 성격별 반응 (반응 원칙 키의 간이판)
    if (analysis.utteranceValidity === 'SHORT' || analysis.utteranceValidity === 'UNCLEAR') {
      return '음, 조금만 더 자세히 말해줄 수 있어?';
    }
    if (analysis.childIntent === 'QUESTION') {
      return '좋은 질문이야! 너는 어떻게 생각하는지 먼저 듣고 싶어.';
    }

    if (mode === 'GUIDED' && guidanceTarget && GUIDANCE_LINES[guidanceTarget]) {
      return GUIDANCE_LINES[guidanceTarget];
    }

    // NORMAL: 수용 + (missing 남아 있으면 약한 유도 = soft-cue)
    const ack = '그렇구나, 이야기해줘서 고마워.';
    const softTarget = missingElements[0];
    if (softTarget && GUIDANCE_LINES[softTarget]) {
      return `${ack} ${GUIDANCE_LINES[softTarget]}`;
    }
    return `${ack} 더 하고 싶은 말이 있으면 들려줘.`;
  }

  // 장면 → API 응답 SceneView 변환 (docs/07-api-design.md 5절)
  toSceneView(scene: StoryScene, session: Pick<StorySession, 'currentChildTurnCount'>) {
    return {
      sceneId: scene.id,
      sceneOrder: scene.sceneOrder,
      sceneType: scene.sceneType,
      imageUrl: scene.imageUrl,
      narration: scene.sceneType === 'dialogue' ? null : scene.sceneDescription,
      characterName: scene.characterName,
      maxTurns: scene.maxTurns,
      currentChildTurnCount: session.currentChildTurnCount,
    };
  }
}
