import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { stopSpeaking } from '../lib/tts';
import { useSpeechInput } from '../lib/useSpeechInput';
import type { ChildInfo } from '../lib/types';

interface Card {
  id: string;
  text: string;
}

// 말하기 후 활동 (FR-07)
// 1) 무작위 카드를 이야기 순서대로 탭해서 배열 → 서버가 판정
// 2) 정답이면 핵심 단어 공개 → 이야기 재구성 (음성 준비 전까지 타이핑 입력)
export default function PostActivityPage({
  sessionId,
  child,
  onDone,
}: {
  sessionId: string;
  child: ChildInfo;
  onDone: () => void;
}) {
  const [step, setStep] = useState<'order' | 'retell' | 'done'>('order');
  const [cards, setCards] = useState<Card[]>([]);
  const [picked, setPicked] = useState<string[]>([]); // 탭한 순서대로 카드 id 저장
  const [keywords, setKeywords] = useState<string[]>([]);
  const [retellText, setRetellText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mic = useSpeechInput(setRetellText); // 재구성 말하기 음성 입력

  useEffect(() => {
    api<{ cards: Card[] }>(`/sessions/${sessionId}/post-activity`)
      .then((res) => setCards(res.cards))
      .catch((e) => setError(e instanceof ApiError ? `오류 ${e.status}: ${e.code}` : String(e)));
  }, [sessionId]);

  // 카드 탭: 미선택이면 다음 순번으로 추가, 이미 선택했으면 선택 해제
  function toggleCard(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    setFeedback('');
  }

  async function submitOrder() {
    setBusy(true);
    setError('');
    try {
      const res = await api<{
        correct: boolean;
        retellingKeywords?: string[];
        attemptCount?: number;
      }>(`/sessions/${sessionId}/post-activity/order`, {
        method: 'POST',
        body: JSON.stringify({ submittedOrder: picked }),
      });
      if (res.correct) {
        setKeywords(res.retellingKeywords ?? []);
        setStep('retell');
      } else {
        setFeedback('음, 순서가 조금 다른 것 같아요. 다시 한번 해볼까요?');
        setPicked([]);
      }
    } catch (e) {
      setError(e instanceof ApiError ? `오류 ${e.status}: ${e.code}` : String(e));
    }
    setBusy(false);
  }

  async function submitRetelling() {
    setBusy(true);
    setError('');
    try {
      await api(`/sessions/${sessionId}/post-activity/retelling`, {
        method: 'POST',
        body: JSON.stringify({ text: retellText }),
      });
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? `오류 ${e.status}: ${e.code}` : String(e));
    }
    setBusy(false);
  }

  if (step === 'done') {
    return (
      <main className="center">
        <div className="card">
          <h1>오늘 활동 끝! 🎉</h1>
          <p className="sub">{child.name}, 이야기를 처음부터 끝까지 잘 해냈어요.</p>
          <button onClick={onDone}>홈으로</button>
        </div>
      </main>
    );
  }

  if (step === 'retell') {
    return (
      <main className="center">
        <div className="card">
          <h1>정답이에요! 👏</h1>
          <p className="sub">이 단어들을 써서 이야기를 다시 말해볼까요?</p>
          <p>
            {keywords.map((k) => (
              <span key={k} className="keyword">
                {k}
              </span>
            ))}
          </p>
          {mic.supported && (
            <button
              type="button"
              className={`micbtn wide${mic.listening ? ' on' : ''}`}
              onClick={() => {
                stopSpeaking(); // 재생 중 음성 즉시 중단 후 녹음 시작
                if (mic.listening) mic.stop();
                else mic.start();
              }}
              disabled={busy}
            >
              {mic.listening ? '🎤 듣고 있어요...' : '🎤 말로 이야기하기'}
            </button>
          )}
          {mic.micError && <p className="msg">{mic.micError}</p>}
          <textarea
            rows={4}
            placeholder="옛날에 방귀를 크게 뀌는 며느리가 살았는데..."
            value={retellText}
            onChange={(e) => setRetellText(e.target.value)}
          />
          {error && <p className="msg">{error}</p>}
          <button onClick={submitRetelling} disabled={busy || retellText.trim().length < 5}>
            {busy ? '저장 중...' : '다 말했어요'}
          </button>
        </div>
      </main>
    );
  }

  // step === 'order'
  return (
    <main className="center">
      <div className="card">
        <h1>이야기 순서 맞추기</h1>
        <p className="sub">일어난 순서대로 카드를 눌러보세요 (누른 순서 = 이야기 순서)</p>

        {cards.map((c) => {
          const order = picked.indexOf(c.id); // -1이면 미선택
          return (
            <button
              key={c.id}
              className={`pcard${order >= 0 ? ' picked' : ''}`}
              onClick={() => toggleCard(c.id)}
            >
              <span className="badge">{order >= 0 ? order + 1 : ''}</span>
              {c.text}
            </button>
          );
        })}

        {feedback && <p className="msg">{feedback}</p>}
        {error && <p className="msg">{error}</p>}

        <button onClick={submitOrder} disabled={busy || picked.length !== cards.length}>
          {busy ? '확인 중...' : `순서 제출 (${picked.length}/${cards.length})`}
        </button>
      </div>
    </main>
  );
}
