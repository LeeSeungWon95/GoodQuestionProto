import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { ChildInfo, Story } from './lib/types';
import LoginPage from './pages/LoginPage';
import ChildSelectPage from './pages/ChildSelectPage';
import HomePage from './pages/HomePage';
import StoryPlayPage from './pages/StoryPlayPage';

// 앱의 최상위 컴포넌트 — 세 개의 데이터(세션, 선택된 아이, 재생 중 이야기)로 화면을 결정한다.
//   session 없음            → 로그인 화면
//   아이 미선택              → 아이 선택 화면
//   이야기 선택됨            → 이야기 재생 화면
//   그 외                   → 홈 화면
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [playingStory, setPlayingStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) setChild(null); // 로그아웃하면 아이 선택도 초기화
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <p className="center">불러오는 중...</p>;
  if (!session) return <LoginPage />;
  if (!child) return <ChildSelectPage onSelect={setChild} />;
  if (playingStory)
    return (
      <StoryPlayPage child={child} story={playingStory} onExit={() => setPlayingStory(null)} />
    );
  return (
    <HomePage child={child} onSwitchChild={() => setChild(null)} onPlayStory={setPlayingStory} />
  );
}
