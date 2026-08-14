import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { personalize } from '../lib/personalize';
import { speak, splitSentences, stopSpeaking, ttsSupported } from '../lib/tts';
import { useSpeechInput } from '../lib/useSpeechInput';
import type { CharacterMessage, SceneView } from '../lib/types';

interface ChatMessage {
  id: string;
  who: 'child' | 'character';
  text: string;
}

interface SubmitResult {
  childMessage: { messageId: string; text: string };
  characterMessage: CharacterMessage;
  sceneStatus: 'continue' | 'closed';
  endReason?: 'GOAL_MET' | 'MAX_TURNS';
  isStoryComplete?: boolean;
  turn?: { current: number; max: number | null };
}

// 대화 장면 패널 (FR-05·06의 화면부)
// 지금은 음성 대신 타이핑 입력 — STT 연동 시 입력부만 마이크로 교체하면 된다.
export default function DialoguePanel({
  sessionId,
  scene,
  childName,
  onSceneClosed,
}: {
  sessionId: string;
  scene: SceneView;
  childName: string; // 콘텐츠의 ㅇㅇ 자리에 넣을 아이 이름
  onSceneClosed: (isStoryComplete: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    scene.characterMessage
      ? [
          {
            id: scene.characterMessage.messageId,
            who: 'character',
            text: personalize(scene.characterMessage.text, childName),
          },
        ]
      : [],
  );
  const [input, setInput] = useState('');
  const [turn, setTurn] = useState({ current: scene.currentChildTurnCount, max: scene.maxTurns });
  const [closed, setClosed] = useState(false);
  const [storyComplete, setStoryComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 음성 입력 — 인식 결과를 입력창에 채우고, 아이가 [보내기]로 확정 (FR-05 흐름)
  const mic = useSpeechInput(setInput);

  // 입력칸 자동 확장: 내용 길이에 맞춰 키가 늘어남 (최대 220px, 그 이상만 스크롤)
  const boxRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
    }
  }, [input]);

  // 캐릭터 대사 자동 낭독 (FR-04·인터뷰 #2) — 새 캐릭터 메시지가 도착하면 재생
  const lastCharacterText = [...messages].reverse().find((m) => m.who === 'character')?.text ?? '';
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.who === 'character') speak(last.text);
    return stopSpeaking; // 아이가 보내거나 화면을 떠나면 중단
  }, [messages]);

  async function send() {
    mic.stop(); // 말하던 중 보내기를 눌러도 마이크 자동 종료
    const text = input.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    setInput('');
    // 아이 발화를 먼저 화면에 올린다 (서버 응답 대기 중에도 대화가 보이도록)
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, who: 'child', text }]);

    try {
      const res = await api<SubmitResult>(`/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: res.characterMessage.messageId,
          who: 'character',
          text: personalize(res.characterMessage.text, childName),
        },
      ]);
      if (res.sceneStatus === 'closed') {
        setClosed(true);
        setStoryComplete(res.isStoryComplete ?? false);
      } else if (res.turn) {
        setTurn(res.turn);
      }
    } catch (err) {
      setError(err instanceof ApiError ? `오류 ${err.status}: ${err.code}` : String(err));
    }
    setBusy(false);
  }

  return (
    <>
      <p className="meta">
        {scene.characterName}
        {turn.max ? ` · 대화 ${turn.current}/${turn.max}` : ''}
      </p>

      <div className="chat">
        {messages.map((m) => (
          <p key={m.id} className={m.who === 'character' ? 'bubble' : 'bubble-child'}>
            {/* 한 문장씩 줄을 나눠 표시 — 저학년 가독성 (인터뷰 #1) */}
            {splitSentences(m.text).map((s, i) => (
              <span key={i} className="line">
                {s}
              </span>
            ))}
          </p>
        ))}
        {busy && <p className="bubble thinking">생각 중...</p>}
      </div>

      {ttsSupported && lastCharacterText && !busy && (
        <button className="link" onClick={() => speak(lastCharacterText)}>
          🔊 다시 듣기
        </button>
      )}

      {error && <p className="msg">{error}</p>}

      {closed ? (
        <button onClick={() => onSceneClosed(storyComplete)}>
          {storyComplete ? '말하기 후 활동으로' : '다음 장면으로'}
        </button>
      ) : (
        <>
          {mic.listening && (
            <p className="note listening">
              🎤 듣고 있어요 — 천천히 생각하며 말해도 돼요. 다 말하면 🎤를 다시 눌러주세요
            </p>
          )}
          {mic.micError && <p className="msg">{mic.micError}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="inputrow"
          >
            {mic.supported && (
              <button
                type="button"
                className={`micbtn${mic.listening ? ' on' : ''}`}
                onClick={() => {
                  stopSpeaking(); // 캐릭터가 말하는 중이면 즉시 멈춤 — 아이 발화 방해 금지
                  if (mic.listening) mic.stop();
                  else mic.start();
                }}
                disabled={busy}
                aria-label="음성으로 말하기"
              >
                🎤
              </button>
            )}
            <textarea
              ref={boxRef}
              className="talkbox"
              rows={3}
              placeholder={
                mic.supported
                  ? '🎤를 누르고 말하거나, 글로 적어보세요'
                  : `${scene.characterName}에게 대답해보세요`
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(); // Enter로 전송 (줄바꿈은 Shift+Enter)
                }
              }}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              보내기
            </button>
          </form>
        </>
      )}
    </>
  );
}
