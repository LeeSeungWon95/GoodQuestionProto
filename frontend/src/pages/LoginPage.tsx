import { useState } from 'react';
import { supabase } from '../lib/supabase';

// 보호자 로그인 / 회원가입 화면 (FR-01)
// 인증은 백엔드를 거치지 않고 Supabase Auth와 직접 통신한다.
export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // 폼 제출 시 페이지 새로고침(전통 방식) 방지 — SPA는 새로고침 없이 처리
    setBusy(true);
    setMessage('');

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(`로그인 실패: ${error.message}`);
      // 성공 시에는 App.tsx의 onAuthStateChange가 감지해서 홈으로 자동 전환
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(`가입 실패: ${error.message}`);
      } else if (!data.session) {
        // Supabase 설정에서 "이메일 확인"이 켜져 있으면 세션 없이 가입만 됨
        setMessage('가입 완료. 이메일함에서 확인 메일을 눌러야 로그인할 수 있어요.');
      }
    }
    setBusy(false);
  }

  return (
    <main className="center">
      <div className="card">
        <h1>굿퀘스천</h1>
        <p className="sub">이야기로 배우는 말하기 교육</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        {message && <p className="msg">{message}</p>}

        <button
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setMessage('');
          }}
        >
          {mode === 'login' ? '처음이신가요? 회원가입' : '이미 계정이 있나요? 로그인'}
        </button>
      </div>
    </main>
  );
}
