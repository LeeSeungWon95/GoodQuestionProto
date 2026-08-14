import { useState } from 'react';
import { api, ApiError } from '../lib/api';
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
  onSceneClosed,
}: {
  sessionId: string;
  scene: SceneView;
  onSceneClosed: (isStoryComplete: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    scene.characterMessage
      ? [{ id: scene.characterMessage.messageId, who: 'character', text: scene.characterMessage.text }]
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

  async function send(e: React.FormEvent) {
    e.preventDefault();
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
        { id: res.characterMessage.messageId, who: 'character', text: res.characterMessage.text },
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
            {m.text}
          </p>
        ))}
        {busy && <p className="bubble thinking">생각 중...</p>}
      </div>

      {error && <p className="msg">{error}</p>}

      {closed ? (
        <button onClick={() => onSceneClosed(storyComplete)}>
          {storyComplete ? '말하기 후 활동으로' : '다음 장면으로'}
        </button>
      ) : (
        <>
          {mic.listening && <p className="note listening">🎤 듣고 있어요... 다 말하면 잠깐 기다려주세요</p>}
          <form onSubmit={send} className="inputrow">
            {mic.supported && (
              <button
                type="button"
                className={`micbtn${mic.listening ? ' on' : ''}`}
                onClick={() => (mic.listening ? mic.stop() : mic.start())}
                disabled={busy}
                aria-label="음성으로 말하기"
              >
                🎤
              </button>
            )}
            <input
              placeholder={
                mic.supported
                  ? '🎤를 누르고 말하거나, 글로 적어보세요'
                  : `${scene.characterName}에게 대답해보세요`
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
