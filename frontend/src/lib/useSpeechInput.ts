import { useEffect, useRef, useState } from 'react';

// 브라우저 내장 음성 인식(Web Speech API)으로 음성 → 텍스트.
// - OpenAI 불필요, HTTPS(또는 localhost)에서만 동작
// - 연속 듣기: 아이가 생각하느라 말을 멈춰도 끊지 않고, 브라우저가 세션을 끊으면
//   자동으로 다시 이어 들으며 텍스트를 누적한다. 종료는 아이가 🎤를 다시 눌러서.
// - 인식 결과는 입력창에 채워지고, 아이가 [보내기]로 확정 (요건 FR-05의 확정 흐름)

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

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '마이크 권한이 차단되어 있어요. 브라우저 설정에서 이 사이트의 마이크를 허용해주세요.',
  'service-not-allowed': '이 브라우저에서 음성 인식 서비스가 막혀 있어요.',
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
  const wantRef = useRef(false); // 사용자가 "계속 듣기"를 원하는 상태 (버튼으로 제어)
  const ignoreRef = useRef(false); // 파기 정지 후 늦게 도착하는 인식 결과 무시 (입력칸 되살아남 방지)
  const baseRef = useRef(''); // 이전 인식 세션까지 누적 확정된 텍스트
  const lastRef = useRef(''); // 현재 세션에서 마지막으로 받은 텍스트
  const supported = getRecognitionCtor() !== null;

  // 화면을 떠나면 인식 종료
  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.stop();
    },
    [],
  );

  function begin() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = 'ko-KR';
    rec.interimResults = true; // 말하는 중간중간 실시간 표시
    rec.continuous = true; // 잠깐 침묵해도 바로 끊지 않음

    rec.onresult = (e) => {
      if (ignoreRef.current) return; // 파기 정지 이후의 늦은 결과는 버림
      const text = Array.from(e.results, (r) => r[0].transcript).join('');
      lastRef.current = text;
      onText(`${baseRef.current} ${text}`.trim());
    };
    rec.onend = () => {
      // 브라우저가 (긴 침묵 등으로) 세션을 끊어도, 아이가 멈추기 전이면 이어서 다시 듣는다
      baseRef.current = `${baseRef.current} ${lastRef.current}`.trim();
      lastRef.current = '';
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          wantRef.current = false;
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };
    rec.onerror = (e) => {
      const code = e?.error ?? 'unknown';
      if (code === 'aborted') return; // 사용자가 직접 중지 — 오류 아님
      if (code === 'no-speech') return; // 잠시 조용했을 뿐 — onend에서 자동 재시작
      wantRef.current = false;
      setListening(false);
      setMicError(ERROR_MESSAGES[code] ?? `음성 인식 실패 (원인 코드: ${code})`);
    };

    recRef.current = rec;
    rec.start(); // 최초 1회 브라우저가 마이크 권한을 물어봄
  }

  function start() {
    if (listening) return;
    setMicError('');
    baseRef.current = '';
    lastRef.current = '';
    wantRef.current = true;
    ignoreRef.current = false;
    setListening(true);
    try {
      begin();
    } catch {
      wantRef.current = false;
      setListening(false);
      setMicError('음성 인식을 시작하지 못했어요.');
    }
  }

  // 보통 정지: 지금까지 말한 텍스트는 입력칸에 유지 (🎤 버튼으로 끌 때)
  function stop() {
    wantRef.current = false;
    recRef.current?.stop();
  }

  // 파기 정지: 정지 + 이후 도착하는 인식 결과 무시 (보내기·제출 직후 입력칸 오염 방지)
  function cancel() {
    ignoreRef.current = true;
    wantRef.current = false;
    recRef.current?.stop();
  }

  return { supported, listening, micError, start, stop, cancel };
}
