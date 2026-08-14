// 브라우저 내장 음성 합성(speechSynthesis)으로 캐릭터 대사·내레이션 재생
// - OpenAI 불필요. 기기 내장 한국어 목소리 사용 (기기마다 음색 다름)
// - 인터뷰 요구(#2)이자 필수 요건 FR-04: 캐릭터 음성 자동 재생 + 다시 듣기
// - 추후 OpenAI TTS 도입 시 이 모듈만 교체하면 됨 (비상용 대체 경로로도 유지)

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string) {
  if (!ttsSupported || !text) return;
  window.speechSynthesis.cancel(); // 이전 재생 중단 (겹침 방지)
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.95; // 아이가 듣기 좋게 살짝 느리게
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (ttsSupported) window.speechSynthesis.cancel();
}

// 저학년 배려: 긴 대사를 문장 단위로 나눠 표시하기 위한 공용 유틸 (인터뷰 #1)
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).filter((s) => s.trim().length > 0);
}
