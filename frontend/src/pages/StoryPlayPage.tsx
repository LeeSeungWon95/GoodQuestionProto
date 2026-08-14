import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { ChildInfo, SceneView, Story } from '../lib/types';
import DialoguePanel from '../components/DialoguePanel';
import PostActivityPage from './PostActivityPage';

// 이야기 상세 → 장면 재생 화면 (FR-03, FR-04의 뼈대)
// 도입/전개 장면은 내레이션을 보여주고 [다음]으로 진행한다.
// 대화 장면은 캐릭터 첫 대사까지 표시 — 음성 대화(FR-05·06)는 OpenAI 연동 후 이 자리에 들어온다.
export default function StoryPlayPage({
  child,
  story,
  onExit,
}: {
  child: ChildInfo;
  story: Story;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<'detail' | 'playing' | 'post'>('detail');
  const [sessionId, setSessionId] = useState('');
  const [scene, setScene] = useState<SceneView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // 이 이야기의 미완료 세션 존재 여부 → [이어하기]/[처음부터 다시] 분기
  const [hasUnfinished, setHasUnfinished] = useState(false);

  useEffect(() => {
    api<{ session: { storyId: string } | null }>(`/children/${child.id}/active-session`)
      .then((res) => setHasUnfinished(res.session?.storyId === story.id))
      .catch(() => setHasUnfinished(false));
  }, [child.id, story.id]);

  async function startSession(restart = false) {
    setBusy(true);
    setError('');
    try {
      const res = await api<{
        sessionId: string;
        resumed: boolean;
        status: 'in_progress' | 'post_activity';
        scene: SceneView | null;
      }>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ childId: child.id, storyId: story.id, restart }),
      });
      setSessionId(res.sessionId);
      if (res.status === 'post_activity') {
        setPhase('post'); // 후속 활동 단계에서 이어하기
      } else {
        setScene(res.scene);
        setPhase('playing');
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CONSENT_REQUIRED') {
        setError('아이의 개인정보 동의가 필요해요. 아이 등록 화면에서 동의를 진행해주세요.');
      } else {
        setError(e instanceof ApiError ? `오류 ${e.status}: ${e.code}` : String(e));
      }
    }
    setBusy(false);
  }

  async function advance() {
    setBusy(true);
    setError('');
    try {
      const res = await api<{ scene: SceneView | null; storyComplete: boolean }>(
        `/sessions/${sessionId}/scene-advance`,
        { method: 'POST' },
      );
      if (res.storyComplete) {
        setPhase('post'); // 이야기 완료 → 말하기 후 활동으로 전환
      } else {
        setScene(res.scene);
      }
    } catch (e) {
      setError(e instanceof ApiError ? `오류 ${e.status}: ${e.code}` : String(e));
    }
    setBusy(false);
  }

  if (phase === 'detail') {
    return (
      <main className="center">
        <div className="card">
          <h1>{story.title}</h1>
          <p className="sub">
            {story.topics.join(' · ')} · 난이도 {story.difficulty} · 약 {story.estimatedMinutes}분
          </p>
          <p>{story.summary}</p>
          <p className="meta">{child.name}(이)가 이야기 속 인물들과 직접 대화하게 돼요.</p>
          {error && <p className="msg">{error}</p>}
          {hasUnfinished ? (
            <>
              <button onClick={() => startSession()} disabled={busy}>
                {busy ? '준비 중...' : '▶ 이어하기 (하던 데부터)'}
              </button>
              <button className="link" onClick={() => startSession(true)} disabled={busy}>
                처음부터 다시 시작
              </button>
            </>
          ) : (
            <button onClick={() => startSession()} disabled={busy}>
              {busy ? '준비 중...' : '이야기 시작'}
            </button>
          )}
          <button className="link" onClick={onExit}>
            ← 목록으로
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'post') {
    return <PostActivityPage sessionId={sessionId} child={child} onDone={onExit} />;
  }

  // phase === 'playing'
  if (!scene) return <p className="center">장면을 불러오는 중...</p>;

  return (
    <main className="center">
      <div className="card wide">
        <p className="meta">
          {story.title} · 장면 {scene.sceneOrder}/9
        </p>

        {scene.sceneType !== 'dialogue' ? (
          <>
            {/* 도입·전개: 내레이션 (콘텐츠 문서: 전체 화면 스토리 영역) */}
            <p className="narration">{scene.narration}</p>
            <button onClick={advance} disabled={busy}>
              {busy ? '...' : '다음으로'}
            </button>
          </>
        ) : (
          <DialoguePanel
            key={scene.sceneId} // 장면이 바뀌면 대화 내역을 새로 시작
            sessionId={sessionId}
            scene={scene}
            onSceneClosed={(isStoryComplete) => {
              if (isStoryComplete) setPhase('post');
              else advance();
            }}
          />
        )}

        <button className="link" onClick={onExit}>
          그만하기
        </button>
      </div>
    </main>
  );
}
