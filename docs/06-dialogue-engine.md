# 굿퀘스천 — 대화 엔진 판정 규칙 요약

> 근거: 「굿퀘스천_MVP_대화작동규칙_260803_수정안」. 구현 시 이 문서가 아닌 원문을 최종 기준으로 삼되,
> 여기서는 서버·프롬프트 구현에 필요한 규칙을 요약한다.

## 1. 구현 경계 (3분리 원칙)

| 역할 | 담당 | 하는 일 | 하지 않는 일 |
|---|---|---|---|
| 분석 LLM | OpenAI GPT | 최신 아이 발화 **1건**을 구조화: childIntent, mainPoint, detectedElements(+evidence), utteranceValidity | 누적 요소 갱신, 모드 결정, 다음 질문 유형 선택 |
| 서버 규칙 | NestJS | 요소 누적 갱신, missing 계산, 응답 모드·종료 판정, soft-cue 여부, reactionKey 결정 | 대사 생성 |
| 캐릭터 LLM | OpenAI GPT | 주어진 모드·반응 원칙에 따라 캐릭터 대사만 생성 | 진행 판정. CLOSING 시에는 생성하지 않음(고정 마지막 대사 조회) |

## 2. 처리 흐름 (8단계)

```
1 고정 첫 대사 조회·재생(TTS) → 2 아이 음성 입력 → 3 STT 변환·화면 표시(원본 음성 미저장)
→ 4 보내기: 확정 발화 messages 저장 → 5 발화 분석(LLM) → 6 누적 요소 갱신·반응 확정(서버)
→ 7 중간 대사 생성(캐릭터 LLM) 또는 고정 마지막 대사 조회 → 8 응답 저장·TTS → 반복 또는 장면 전환
```

## 3. 분석 LLM 입출력

**입력** (이것만 전달 — story_title, character_name, 누적 요소, 턴 수는 넣지 않는다):

| 입력값 | 출처 |
|---|---|
| sceneContext | `scene_description` + `conflict` (길이 제한) |
| previousCharacterMessage | messages 중 최근 character 발화 |
| childUtterance | 최신 child 발화 |
| targetElements | `story_scenes.required_elements` |

**출력**: childIntent(13종), mainPoint(없으면 null), detectedElements `[{type, evidence}]`, utteranceValidity(5종)

**서버 후처리**:
- evidence가 아이 발화 원문에 포함되지 않으면 해당 요소 폐기
- type 중복 제거
- 약한 당위(~해야 해요 수준)만 있는 SOLUTION은 제외 가능
- `새 accumulated = 기존 accumulated ∪ detected type` / `missing = required − accumulated`

## 4. 응답 모드 결정 (서버 규칙 — 우선순위 순)

| 조건 | 결과 |
|---|---|
| turnCount ≥ preferred_turns(minTurns) 이고 missing 없음 | **CLOSING**, endReason = GOAL_MET |
| turnCount ≥ max_turns | **CLOSING**, endReason = MAX_TURNS |
| 첫 아이 발화 / 이번 턴 신규 요소 있음 / 직전이 GUIDED | **NORMAL 강제** |
| missing 있고, 직전 GUIDED 아님, (저정보 2연속 or 신규 요소 없음 2회 or 남은 턴 ≤ 2) | **GUIDED** + guidanceTarget |
| 그 외 | **NORMAL** |

**NORMAL soft-cue**: NORMAL이어도 (신규 요소 있음 + missing 남음 + 장난·질문·불명확 반응 아님)이면 remainingWorries[대상 요소]를 약한 유도로 삽입 가능 — 모드는 NORMAL 유지.

## 5. utteranceValidity → 서버 영향

| 값 | 기준 | 영향 |
|---|---|---|
| VALID | 의미 파악 가능 | 일반 경로 |
| SHORT | 지나치게 짧음 | 저정보 카운트, unclear 반응 후보 |
| UNCLEAR | 뜻을 알기 어려움 | 저정보 카운트, unclear 반응 |
| OFF_TOPIC | 장면과 무관 | 저정보 카운트, playful 반응 쪽 |
| PLAYFUL | 장난·소리 흉내 | soft-cue 스킵, playful 반응 |

## 6. 반응 원칙 키 (reactionKey)

| 조건 | reactionKey | 동작 |
|---|---|---|
| PLAYFUL / OFF_TOPIC | playfulUtterance | 장난을 실제 사건으로 단정하지 않고 받아침 |
| QUESTION | questionFromChild | 질문에 먼저 답함 |
| SOLUTION (intent 또는 detected) | proposalFromChild | 제안의 도움 되는 점 인정, 중간 턴엔 걱정 하나만 |
| SHORT / UNCLEAR | unclearUtterance | 필요할 때만 짧게 되물음 |
| EMPATHY | empathyFromChild / directResponse | 공감 반응 |
| 의견·반박·결정 등 | disagreement | 무조건 부정하지 않고 걱정 하나 |
| CLOSING 턴 | directResponse | 의도 매핑 무시, 마무리 톤 |
| 그 외 | directResponse | 최신 말에 직접 반응 |

- soft-cue 스킵 대상: playfulUtterance, questionFromChild, unclearUtterance
- GUIDED 재료: remainingWorries[guidanceTarget] → mode instruction의 focus. **재료(worry)가 없으면 교육용 fallback 문구를 넣지 않는다**
- guidanceStyle: 유도를 "어떻게 드러낼지"의 캐릭터별 표현 방식

## 7. 사고 요소 8종 정의

| 코드 | 의미 |
|---|---|
| DECISION | 행동·상황에 대한 판단·선택 |
| REASON | 생각·판단의 이유 |
| PERSPECTIVE | 다른 인물의 입장·상황 고려 |
| SOLUTION | 문제를 줄일 실제 방법·행동 |
| RESULT | 행동 이후 결과·영향 |
| EMOTION | 감정 표현 |
| EMPATHY | 다른 인물의 감정·어려움 이해 |
| REQUEST | 캐릭터에게 바라는 행동·태도 |
