import { useRef, useState } from 'react';

// 브라우저 내장 음성 인식(Web Speech API)으로 음성 → 텍스트.
// - OpenAI 불필요, HTTPS(또는 localhost)에서만 동작
// - 인식 결과는 입력창에 채워지고, 아이가 [보내기]로 확정 (요건 FR-05의 확정 흐름)
// - 지원 안 되는 브라우저에서는 supported=false → 마이크 버튼을 숨기면 됨

// Web Speech API는 표준 TS 타입에 없어서 필요한 최소한만 선언
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionErrorLike {
  error?: string; // not-allowed | no-speech | network | service-not-allowed ...
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  start(): void;
  stop(): void;
}

// 인식 실패 코드 → 사람이 읽을 수 있는 안내
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '마이크 권한이 차단되어 있어요. 브라우저 설정에서 이 사이트의 마이크를 허용해주세요.',
  'service-not-allowed': '이 브라우저에서 음성 인식 서비스가 막혀 있어요.',
  'no-speech': '목소리가 들리지 않았어요. 다시 한번 말해볼까요?',
  network: '음성 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.',
  'audio-capture': '마이크를 찾을 수 없어요. 기기에 마이크가 있는지 확인해주세요.',
  'language-not-supported': '이 기기에서 한국어 음성 인식을 지원하지 않아요.',
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export function useSpeechInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
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
    rec.onerror = (e) => {
      setListening(false);
      const code = e?.error ?? 'unknown';
      if (code === 'aborted') return; // 사용자가 직접 중지한 경우는 오류 아님
      setMicError(ERROR_MESSAGES[code] ?? `음성 인식 실패 (원인 코드: ${code})`);
    };

    recRef.current = rec;
    setMicError('');
    setListening(true);
    try {
      rec.start(); // 최초 1회 브라우저가 마이크 권한을 물어봄
    } catch {
      setListening(false);
      setMicError('음성 인식을 시작하지 못했어요.');
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  return { supported, listening, micError, start, stop };
}
