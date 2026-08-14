import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { ChildInfo, Story } from '../lib/types';

interface ActiveSession {
  id: string;
  storyId: string;
  storyTitle: string;
  status: 'in_progress' | 'post_activity';
}

// 홈 화면 (FR-02의 뼈대) — 지금은 이야기 목록만. 이어하기·추천 영역은 다음 단계에서.
export default function HomePage({
  child,
  onSwitchChild,
  onPlayStory,
  onContinueStory,
}: {
  child: ChildInfo;
  onSwitchChild: () => void;
  onPlayStory: (story: Story) => void;
  onContinueStory: (story: Story) => void;
}) {
  const [stories, setStories] = useState<Story[]>([]);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ stories: Story[] }>('/stories')
      .then((res) => setStories(res.stories))
      .catch((e) => setError(e instanceof ApiError ? `오류 ${e.status}: ${e.code}` : String(e)));
    // 이어하기 (FR-02): 진행 중인 세션이 있으면 홈 상단에 표시
    api<{ session: ActiveSession | null }>(`/children/${child.id}/active-session`)
      .then((res) => setActive(res.session))
      .catch(() => setActive(null)); // 이어하기 조회 실패는 홈 표시를 막지 않음
  }, [child.id]);

  const activeStory = active ? stories.find((s) => s.id === active.storyId) : undefined;

  return (
    <main className="center">
      <div className="card">
        <h1>{child.name}의 이야기</h1>
        <p className="sub">읽고 싶은 이야기를 골라보세요</p>

        {error && <p className="msg">{error}</p>}

        {activeStory && (
          <button className="continue" onClick={() => onContinueStory(activeStory)}>
            ▶ 이어하기 — {active!.storyTitle}
            <span className="meta">
              {active!.status === 'post_activity' ? '순서 맞추기 하던 중' : '이야기 듣던 중'}
            </span>
          </button>
        )}

        {stories.map((s) => (
          <button key={s.id} className="story" onClick={() => onPlayStory(s)}>
            <strong>{s.title}</strong>
            <p>{s.summary}</p>
            <p className="meta">
              주제: {s.topics.join(', ')} · 난이도 {s.difficulty} · 약 {s.estimatedMinutes}분
            </p>
          </button>
        ))}

        <button className="link" onClick={onSwitchChild}>
          아이 바꾸기
        </button>
      </div>
    </main>
  );
}
