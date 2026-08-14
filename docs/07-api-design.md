# 굿퀘스천 — API 설계

> 기준: 화면 흐름(02) × DB 구조(03) × 대화 엔진 규칙(06).
> 공통: Base URL `/api/v1`, 형식 JSON, 인증은 `Authorization: Bearer <Supabase JWT>` (모든 엔드포인트).
> 가입·로그인 자체는 API 서버가 아닌 **프론트에서 Supabase SDK로 직접** 처리한다 — 서버는 JWT 검증만.

## 0. 전체 요약표

| 메서드 | 경로 | 용도 | 관련 FR |
|---|---|---|---|
| GET | `/children` | 내 아이 목록 (아이 선택 화면) | FR-01 |
| POST | `/children` | 아이 등록 (+동의 기록) | FR-01 |
| GET | `/stories` | 이야기 목록 (`?topic=` 필터) | FR-02, FR-03 |
| GET | `/stories/:storyId` | 이야기 상세 | FR-03 |
| GET | `/children/:childId/active-session` | 이어하기용 진행 중 세션 조회 | FR-02 |
| POST | `/sessions` | 세션 시작 (동의 검증 포함) | FR-04 |
| GET | `/sessions/:sessionId` | 세션 현재 상태 (이어하기 복원) | FR-02, FR-04 |
| POST | `/sessions/:sessionId/scene-advance` | 도입/전개 완료 → 다음 단계 진입 | FR-04 |
| POST | `/speech/stt` | 음성 → 텍스트 (저장 없음, 확정 전) | FR-05 |
| POST | `/sessions/:sessionId/messages` | 발화 확정 제출 → 분석 → 캐릭터 응답 | FR-05, FR-06, FR-11 |
| GET | `/speech/tts/:messageId` | 캐릭터 대사 음성 (다시 듣기 포함) | FR-04 |
| POST | `/sessions/:sessionId/stop` | 세션 중단 | FR-04 |
| GET | `/sessions/:sessionId/post-activity` | 후속 활동 카드 조회 (무작위 순서) | FR-07 |
| POST | `/sessions/:sessionId/post-activity/order` | 카드 순서 제출 → 서버 판정 | FR-07 |
| POST | `/sessions/:sessionId/post-activity/retelling` | 재구성 발화 제출 → 세션 완료 | FR-07 |

설계 원칙:
- **STT와 발화 확정을 분리** — 엔진 규칙 8단계 중 3단계(변환·표시)와 4단계(보내기·저장)가 분리되어 있으므로, `/speech/stt`는 변환만 하고 저장하지 않는다. 아이가 [보내기]를 누르면 그때 `/messages`로 확정 텍스트를 보낸다. STT 실패 시 메시지를 만들지 않는다는 규칙과도 일치.
- **판정은 전부 서버** — 모드 결정, 요소 누적, 카드 정답 판정 모두 서버가 계산해 결과만 내려준다. 프론트는 표시만.
- **소유권 검증** — 모든 child/session 접근 시 JWT의 `parents.id`와 소유 관계를 서버가 확인.

## 1. 아이 프로필

### GET /children
```json
// 200
{ "children": [ { "id": "c56e...", "name": "민준", "birthYear": 2018, "hasConsent": true } ] }
```

### POST /children
```json
// 요청
{ "name": "민준", "birthYear": 2018,
  "consent": { "consentVersion": "mvp_v1", "verificationMethod": "authenticated_parent" } }
// 201
{ "id": "c56e...", "name": "민준", "birthYear": 2018, "hasConsent": true }
```
- 등록과 동의를 한 요청으로 처리 (`children` + `child_consents` 트랜잭션).
- 동의 없이 등록만 하는 경우는 MVP에서 없음 — 동의 필드는 필수.

## 2. 이야기

### GET /stories?topic=다름
```json
// 200
{ "stories": [ {
  "id": "s01...", "title": "방귀 뀌는 며느리",
  "summary": "큰 방귀를 부끄러워하던 며느리가...", "thumbnailUrl": "...",
  "topics": ["다름", "자기이해", "장점 발견"], "difficulty": "보통", "estimatedMinutes": 20 } ] }
```
- `status = published`만 반환. 메인 화면의 "추천 이야기"도 이 목록의 앞 2~3개를 그대로 사용 (추천 로직 미구현 — D-08).

### GET /stories/:storyId
```json
// 200 — 상세 화면용 (도입·상황·아이 역할)
{ "id": "s01...", "title": "방귀 뀌는 며느리", "summary": "...",
  "topics": ["다름"], "difficulty": "보통", "estimatedMinutes": 20,
  "sceneCount": 9 }
```

## 3. 세션 시작·복원

### GET /children/:childId/active-session
```json
// 200 — 홈 화면 "이어하기" 영역용
{ "session": { "id": "ss01...", "storyId": "s01...", "storyTitle": "방귀 뀌는 며느리",
  "status": "in_progress", "lastActivityAt": "2026-08-11T13:40:00Z" } }
// 진행 중인 세션이 없으면: { "session": null }
```

### POST /sessions
```json
// 요청
{ "childId": "c56e...", "storyId": "s01..." }
// 201 — 첫 장면(도입) 페이로드 포함
{ "sessionId": "ss01...", "scene": { /* SceneView — 아래 5절 */ } }
// 403 — 동의 없음/철회: { "error": "CONSENT_REQUIRED" }
```

### GET /sessions/:sessionId
```json
// 200 — 이어하기 복원: 현재 장면 + 지금까지의 대화
{ "sessionId": "ss01...", "status": "in_progress",
  "scene": { /* SceneView */ },
  "messages": [ { "id": "m01...", "speakerType": "character", "text": "..." },
                { "id": "m02...", "speakerType": "child", "text": "..." } ] }
```

## 4. 장면 진행

### POST /sessions/:sessionId/scene-advance
도입·전개(스토리) 화면의 재생이 끝났을 때 호출. 서버가 `current_scene_id`를 다음 장면으로 이동.
```json
// 200
{ "scene": { /* SceneView — 다음 장면. 대화 장면이면 고정 첫 대사 포함 */ } }
```
- 대화 장면으로 넘어갈 때 서버는 고정 첫 대사를 `messages`에 저장하고 TTS를 준비한다.

## 5. SceneView 공통 구조 (응답 모델)

```json
{
  "sceneId": "sc_banggui_03", "sceneOrder": 3,
  "sceneType": "dialogue",            // "intro" | "story" | "dialogue"
  "imageUrl": "...",
  "narration": null,                   // intro/story일 때: 내레이션 문장 배열
  "characterName": "방귀쟁이 며느리",  // dialogue일 때
  "characterMessage": { "messageId": "m01...", "text": "ㅇㅇ아, 내 방귀가...", "audioUrl": "/api/v1/speech/tts/m01" },
  "maxTurns": 4, "currentChildTurnCount": 0,
  "isLastScene": false
}
```
- `sceneType`은 DB의 장면 구분(도입/전개/대화)을 그대로 노출 — 프론트가 화면 유형(전체 화면/좌측/우측 활성)을 결정하는 근거.

## 6. 음성

### POST /speech/stt  (multipart/form-data: `audio`, `sessionId`)
```json
// 200 — 저장하지 않고 변환만. 화면 표시 → 아이가 [보내기]로 확정
{ "text": "토끼가 모르고 따라가면 억울하니까 속이면 안 돼요" }
// 422 — 인식 실패: { "error": "STT_FAILED" }  → 프론트는 "다시 말해볼까?" 안내, 메시지 미생성
```
- 오디오 포맷: `audio/webm` 또는 `audio/mp4`(iPad Safari) 수용. 서버에서 변환 후 원본 즉시 폐기.

### GET /speech/tts/:messageId
- 캐릭터 메시지의 음성 스트림 반환 (`audio/mpeg`). 다시 듣기 버튼도 같은 URL 재호출.
- 고정 대사(첫/마지막)는 시드 시점에 사전 생성·캐싱 가능 (R-03 지연 대응).

## 7. 대화 턴 (핵심 엔드포인트)

### POST /sessions/:sessionId/messages
```json
// 요청 — [보내기] 시점. text는 아이가 확인한 확정 발화
{ "text": "토끼가 모르고 따라가면 억울하니까 속이면 안 돼요",
  "sttRawText": "토끼가 모르고 따라가면 억울하니까 속이면 안되요" }
```
서버 내부 처리 (동기, 1응답): 메시지 저장 → 분석 LLM → 서버 규칙 판정(모드·누적·미션) → 캐릭터 대사 생성 또는 고정 마지막 대사 조회 → 저장.
```json
// 200 — 장면 계속 (NORMAL/GUIDED)
{ "childMessage": { "messageId": "m05...", "text": "..." },
  "characterMessage": { "messageId": "m06...", "text": "그래도 가족들이 놀라면 어떡하지?", "audioUrl": "/api/v1/speech/tts/m06" },
  "sceneStatus": "continue",
  "missionTrigger": null,
  "turn": { "current": 2, "max": 4 } }

// 200 — 장면 종료 (CLOSING)
{ "childMessage": { "messageId": "m07...", "text": "..." },
  "characterMessage": { "messageId": "m08...", "text": "그래도 아직은 못 말하겠어. 조금만 더 참아 볼게.", "audioUrl": "/api/v1/speech/tts/m08" },
  "sceneStatus": "closed",             // 프론트: 마지막 대사 재생 후 scene-advance 호출
  "endReason": "GOAL_MET",             // GOAL_MET | MAX_TURNS
  "isStoryComplete": false,            // true면 scene-advance 대신 post-activity로 이동
  "missionTrigger": null }

// 200 — 미션 노출 (대화3·대화4, 조건 충족 시)
{ "...": "위와 동일 구조",
  "sceneStatus": "continue",
  "missionTrigger": { "missionId": "mission1", "title": "높이 있는 배 따기", "description": "며느리의 방귀를 안전하게 사용할 방법을 말해보자" } }
```
- 응답 모드(NORMAL/GUIDED)나 reactionKey는 **프론트에 내려주지 않는다** — 프론트 동작이 달라질 게 없고, 내부 판정은 DB에만 기록.
- 미션 수행 발화도 동일하게 이 엔드포인트로 제출 (`missionId` 필드 추가). 미션 결과 저장 방식은 Q-06 확정 후 반영.

## 8. 말하기 후 활동

### GET /sessions/:sessionId/post-activity
```json
// 200 — 카드는 서버가 무작위 순서로 섞어서 반환. 정답 순서는 내려주지 않음
{ "cards": [ { "id": "card_3", "text": "...", "imageUrl": "..." },
             { "id": "card_1", "text": "...", "imageUrl": "..." } ] }
```

### POST /sessions/:sessionId/post-activity/order
```json
// 요청
{ "submittedOrder": ["card_1", "card_2", "card_3", "card_4"] }
// 200 — 정답: 핵심 단어 공개
{ "correct": true, "retellingKeywords": ["용왕", "자라", "토끼", "용궁"] }
// 200 — 오답: 재시도 (attempt_count 증가)
{ "correct": false, "attemptCount": 2 }
```

### POST /sessions/:sessionId/post-activity/retelling
```json
// 요청 — /speech/stt 로 변환·확인한 텍스트
{ "text": "자라는 토끼를 속이려고 했지만 다른 방법을 찾기로 했어요." }
// 200 — 세션 완료 처리 (status → completed)
{ "completed": true }
```

## 9. 오류 규약

| HTTP | code | 의미 |
|---|---|---|
| 401 | `UNAUTHORIZED` | JWT 없음/만료 → 프론트: 로그인 화면 |
| 403 | `FORBIDDEN` | 남의 아이/세션 접근 |
| 403 | `CONSENT_REQUIRED` | 동의 없음/철회 상태에서 세션 시작 시도 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `SESSION_STATE` | 상태에 안 맞는 호출 (예: completed 세션에 발화 제출) |
| 422 | `STT_FAILED` | 음성 인식 실패 (메시지 미생성) |
| 502 | `AI_UPSTREAM` | OpenAI 호출 실패 → 프론트: "다시 한번 말해줄래?" 재시도 안내 |

## 10. 미결 사항

- 미션 결과 저장 스키마 (Q-06) — 확정 전까지 미션 발화는 일반 메시지로 저장
- `narration` 문장 분할 단위 — 콘텐츠 시드 작성 시 확정
- TTS 캐싱 전략 (사전 생성 범위) — 성능 실측 후 결정
