// 프론트 전역에서 공유하는 API 응답 타입들 (docs/07-api-design.md의 응답 형태)

export interface ChildInfo {
  id: string;
  name: string;
  birthYear: number;
  hasConsent: boolean;
}

export interface Story {
  id: string;
  title: string;
  summary: string;
  thumbnailUrl: string | null;
  topics: string[];
  difficulty: string;
  estimatedMinutes: number | null;
}

export interface CharacterMessage {
  messageId: string;
  text: string;
  audioUrl: string;
}

export interface SceneView {
  sceneId: string;
  sceneOrder: number;
  sceneType: 'intro' | 'story' | 'dialogue';
  imageUrl: string | null;
  narration: string | null;
  characterName: string | null;
  characterMessage: CharacterMessage | null;
  maxTurns: number | null;
  currentChildTurnCount: number;
}
