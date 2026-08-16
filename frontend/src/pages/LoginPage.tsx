import { useState } from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 테스트 편의 스위치 — 실서비스 배포 전에 반드시 false 로 바꿀 것
//
// true  (지금, 시연·테스트용):
//   - 아이디만 입력해도 됨: 'admin' → 'admin@test.com' 으로 자동 보정
//   - 로그인 비밀번호 6자 미만 허용 (테스트 계정 admin / 1234)
// false (실서비스):
//   - 반드시 실제 이메일을 입력해야 함 (자동 보정 없음)
//   - 로그인·회원가입 모두 비밀번호 6자 이상 (Supabase 기본 규칙과 일치)
//
// 이 상수 하나만 바꾸면 아래 표시된 곳이 전부 원복된다. 다른 코드는 손댈 필요 없음.
// 실서비스 전환 후에는 Supabase 대시보드의 테스트 계정(admin@test.com)도 삭제할 것.
// ─────────────────────────────────────────────────────────────────────────────
const TEST_LOGIN_SHORTCUT = true;

// 보호자 로그인 / 회원가입 화면 (FR-01)
// 인증은 백엔드를 거치지 않고 Supabase Auth와 직접 통신한다.
export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // [TEST_LOGIN_SHORTCUT] '@' 없는 입력에 @test.com 을 붙인다. false 면 입력값 그대로 사용.
  const toEmail = (v: string) => {
    const t = v.trim();
    return TEST_LOGIN_SHORTCUT && !t.includes('@') ? `${t}@test.com` : t;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // 폼 제출 시 페이지 새로고침(전통 방식) 방지 — SPA는 새로고침 없이 처리
    setBusy(true);
    setMessage('');

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: toEmail(email), password });
      if (error) setMessage(`로그인 실패: ${error.message}`);
      // 성공 시에는 App.tsx의 onAuthStateChange가 감지해서 홈으로 자동 전환
    } else {
      const { data, error } = await supabase.auth.signUp({ email: toEmail(email), password });
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
          {/* [TEST_LOGIN_SHORTCUT] true: 아이디 허용(text) / false: 이메일 형식 강제(email) */}
          <input
            type={TEST_LOGIN_SHORTCUT ? 'text' : 'email'}
            inputMode="email"
            autoCapitalize="none"
            placeholder={TEST_LOGIN_SHORTCUT ? '이메일 또는 아이디' : '이메일'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {/* [TEST_LOGIN_SHORTCUT] true: 로그인 시 6자 미만 허용 / false: 항상 6자 이상 */}
          <input
            type="password"
            placeholder={
              TEST_LOGIN_SHORTCUT && mode === 'login' ? '비밀번호' : '비밀번호 (6자 이상)'
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={TEST_LOGIN_SHORTCUT && mode === 'login' ? undefined : 6}
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
