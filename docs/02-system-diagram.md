# 굿퀘스천 — 시스템 구성도

```mermaid
flowchart LR
    subgraph USERS["사용자"]
        CHILD["아이<br/>태블릿·PC 브라우저 + 마이크"]
        PARENT["보호자<br/>브라우저"]
    end

    subgraph FE["프론트엔드 (정적 호스팅)"]
        SPA["React SPA<br/>반응형 웹 앱<br/>MediaRecorder 녹음 / 오디오 재생"]
    end

    subgraph BE["백엔드 (NestJS API 서버)"]
        PROFILE["children<br/>아이 프로필·동의 관리"]
        STORY["stories<br/>이야기·장면 조회"]
        SESSION["sessions<br/>대화 상태 머신<br/>모드 판정·요소 누적·미션 노출·장면 전환"]
        SPEECH["speech<br/>STT·TTS 프록시"]
        ANALYSIS["analysis<br/>발화 분석 LLM 호출"]
        ACTIVITY["post-activity<br/>카드 정답 판정·재구성 저장"]
    end

    subgraph SB["Supabase"]
        SBAUTH["Auth<br/>이메일·소셜 로그인·JWT"]
        DB[("PostgreSQL<br/>parents·children·consents<br/>stories·scenes·sessions<br/>messages·analyses·results")]
    end

    subgraph EXT["OpenAI"]
        OAI_STT["STT<br/>(음성→텍스트)"]
        OAI_GPT["GPT<br/>(사고 요소·의도·유효성 분석<br/>유도 질문 생성)"]
        OAI_TTS["TTS<br/>(캐릭터 음성)"]
    end

    CHILD --> SPA
    PARENT --> SPA
    SPA -- "가입·로그인 (Supabase SDK)" --> SBAUTH
    SPA -- "HTTPS · REST/JSON + JWT<br/>오디오 업로드(multipart)" --> BE
    BE -. "JWT 검증" .-> SBAUTH
    BE --- DB
    SPEECH --> OAI_STT
    SPEECH --> OAI_TTS
    ANALYSIS --> OAI_GPT
```

## 핵심 시퀀스: 한 턴의 대화 (FR-04 ~ FR-06)

```mermaid
sequenceDiagram
    participant C as 아이(브라우저)
    participant S as API 서버
    participant AI as OpenAI

    S->>AI: 캐릭터 대사 TTS 요청
    AI-->>S: 음성 파일
    S-->>C: 장면 데이터 + 캐릭터 음성
    C->>C: 음성 자동 재생 → 종료 후 마이크 자동 활성화
    C->>C: 아이 발화 녹음 (MediaRecorder)
    C->>S: [보내기] 오디오 업로드
    S->>AI: STT 변환
    AI-->>S: 발화 텍스트
    S->>AI: 발화 분석 (의도·핵심 뜻·사고 요소·유효성)
    AI-->>S: 분석 제안 (detected_elements 등)
    S->>S: 서버 규칙 판정: 요소 누적 → 모드 결정<br/>(NORMAL / GUIDED / CLOSING, 미션 노출 여부)
    alt NORMAL·GUIDED (목표 미충족 & max_turns 미도달)
        S->>AI: 캐릭터 반응·유도 질문 생성 + TTS
        S-->>C: 캐릭터 응답 (부족 요소 유도, 필요 시 미션 노출)
    else CLOSING (preferred_turns+요소 충족 or max_turns 도달)
        S-->>C: 고정 마지막 대사 재생 → 다음 장면<br/>(마지막 장면이면 말하기 후 활동 전환)
    end
```

## 화면 흐름 (팀 화면 흐름도 반영)

```mermaid
flowchart LR
    subgraph G1["1. 진입·사용자 관리"]
        RUN[앱 실행] --> LOGIN[로그인] --> PICK1[아이 선택] --> HOME[홈 화면]
        RUN --> JOIN[회원가입] --> PACC[보호자 계정 생성] --> CREG[아이 프로필 등록<br/>+ 개인정보 동의] --> PICK1
    end
    subgraph G2["2. 홈·이야기 탐색"]
        HOME --> CONT[이어하기]
        HOME --> RECO[추천 이야기] --> DETAIL[이야기 상세]
        HOME --> LIST[이야기 목록] --> DETAIL
    end
    subgraph G3["3. 이야기 학습 진행"]
        DETAIL --> INTRO[도입 화면] --> S1[장면1<br/>전개1+대화1] --> S2[장면2<br/>전개2+대화2] --> S3[장면3<br/>전개3+대화3+미션1] --> S4[장면4<br/>전개4+대화4+미션2] --> POST[후속 활동 화면]
        CONT -.-> INTRO
    end
    subgraph G4["4. 보호자 리포트 (추가)"]
        RPT[보호자 리포트] --> R1[말하기 역량 분석<br/>어휘·논리·표현]
        RPT --> R2[대표 발화 확인]
        RPT --> R3[가정 학습 가이드]
    end
    subgraph G5["5. 설정 및 기타 (추가)"]
        SET[설정]
        NOTICE[공지사항]
        CS[고객센터]
        GUIDE[이용 안내]
        OUT[로그아웃]
    end
```

- 이어하기는 `story_sessions.current_scene_id` + `last_activity_at` 기준으로 중단 지점의 장면으로 직행.
- 장면 화면은 태블릿 가로 기준 좌(전개 스토리)/우(대화) 분할, 순차 활성화.

## 배포 구성 (안)

| 구성 요소 | 배포 위치 | 비고 |
|---|---|---|
| React SPA | Vercel/Netlify 정적 배포 또는 API 서버에서 함께 서빙 | 후자는 CORS 불필요, 구성 단순 |
| NestJS API | Render/Railway/Fly.io 등 PaaS 1 인스턴스 | HTTPS 기본 제공 |
| Auth + PostgreSQL | Supabase | 팀 DB안 전제 (`parents.id` = `auth.users.id`) |
| OpenAI API 키 | 서버 환경변수로만 보관 | 클라이언트 노출 금지 |
