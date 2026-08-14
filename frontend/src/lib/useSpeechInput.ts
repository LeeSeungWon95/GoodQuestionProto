import { useRef, useState } from 'react';

// 브라우저 내장 음성 인식(Web Speech API)으로 음성 → 텍스트.
// - OpenAI 불필요, HTTPS(또는 localhost)에서만 동작
// - 인식 결과는 입력창에 채워지고, 아이가 [보내기]로 확정 (요건 FR-05의 확정 흐름)
// - 지원 안 되는 브라우저에서는 supported=false → 마이크 버튼을 숨기면 됨

// Web Speech API는 표준 TS 타입에 없어서 필요한 최소한만 선언
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export function useSpeechInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = getRecognitionCtor() !== null;

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor || listening) return;

    const rec = new Ctor();
    rec.lang = 'ko-KR';
    rec.interimResults = true; // 말하는 중간중간 결과를 실시간 표시
    rec.continuous = false; // 말이 끝나면(침묵) 자동 종료

    rec.onresult = (e) => {
      const text = Array.from(e.results, (r) => r[0].transcript).join('');
      onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recRef.current = rec;
    setListening(true);
    rec.start(); // 최초 1회 브라우저가 마이크 권한을 물어봄
  }

  function stop() {
    recRef.current?.stop();
  }

  return { supported, listening, start, stop };
}
