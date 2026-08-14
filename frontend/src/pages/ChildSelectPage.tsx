import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { ChildInfo } from '../lib/types';

// 아이 선택 화면 (FR-01) — 세 가지 모드로 동작:
//   normal   아이 선택 + [프로필 관리] [+ 아이 추가 등록] [로그아웃]
//   manage   아이마다 [삭제] + [+ 아이 추가 등록] [← 뒤로가기]
//   register 등록 폼 + [← 뒤로가기] (아이가 0명이면 강제 진입, 뒤로가기 없음)
type Mode = 'normal' | 'manage' | 'register';

export default function ChildSelectPage({ onSelect }: { onSelect: (child: ChildInfo) => void }) {
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('normal');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState(2018);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadChildren(nextMode?: Mode) {
    try {
      const res = await api<{ children: ChildInfo[] }>('/children');
      setChildren(res.children);
      if (res.children.length === 0) setMode('register'); // 등록할 수밖에 없는 상태
      else if (nextMode) setMode(nextMode);
    } catch (e) {
      setError(e instanceof ApiError ? `오류 ${e.status}: ${e.code}` : String(e));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
  }

  async function removeChild(c: ChildInfo) {
    // 되돌릴 수 없는 삭제 — 반드시 확인을 거친다
    const ok = window.confirm(
      `'${c.name}' 프로필과 모든 학습 기록(대화, 활동 결과)이 완전히 삭제됩니다.\n정말 삭제할까요?`,
    );
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await api(`/children/${c.id}`, { method: 'DELETE' });
      await loadChildren('manage'); // 삭제 후에도 관리 모드 유지 (0명이면 자동으로 등록 폼)
    } catch (e) {
      setError(e instanceof ApiError ? `삭제 실패 ${e.status}: ${e.code}` : String(e));
    }
    setBusy(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api<ChildInfo>('/children', {
        method: 'POST',
        body: JSON.stringify({
          name,
          birthYear,
          consent: { consentVersion: 'mvp_v1', verificationMethod: 'authenticated_parent' },
        }),
      });
      setName('');
      setConsented(false);
      await loadChildren('normal'); // 등록 완료 → 평소 모드로
    } catch (e) {
      setError(e instanceof ApiError ? `등록 실패 ${e.status}: ${e.code}` : String(e));
    }
    setBusy(false);
  }

  if (loading) return <p className="center">불러오는 중...</p>;

  const years = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i);

  return (
    <main className="center">
      <div className="card">
        <h1>누가 이야기할까요?</h1>
        <p className="sub">
          {mode === 'manage'
            ? '삭제할 프로필을 선택하세요'
            : mode === 'register'
              ? '새 아이를 등록해요'
              : '아이를 선택하거나 새로 등록하세요'}
        </p>

        {mode !== 'register' &&
          children.map((c) => (
            <div key={c.id} className="childrow">
              <button
                className="child"
                onClick={() => onSelect(c)}
                disabled={mode === 'manage' || busy}
              >
                <strong>{c.name}</strong>
                <span className="meta">{c.birthYear}년생</span>
              </button>
              {mode === 'manage' && (
                <button className="delbtn" onClick={() => removeChild(c)} disabled={busy}>
                  삭제
                </button>
              )}
            </div>
          ))}

        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <input
              placeholder="아이 이름 (별명도 좋아요)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <select value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년생
                </option>
              ))}
            </select>
            <label className="consent">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                required
              />
              <span>
                아동의 학습 데이터(이름, 출생연도, 발화 텍스트) 수집·이용에 보호자로서
                동의합니다. 원본 음성은 저장되지 않습니다.
              </span>
            </label>
            <button type="submit" disabled={busy || !consented}>
              {busy ? '등록 중...' : '아이 등록'}
            </button>
          </form>
        )}

        {error && <p className="msg">{error}</p>}

        <div className="linkrow">
          {mode === 'normal' && (
            <>
              <button className="link" onClick={() => switchMode('manage')}>
                프로필 관리
              </button>
              <button className="link" onClick={() => switchMode('register')}>
                + 아이 추가 등록
              </button>
              <button className="link" onClick={() => supabase.auth.signOut()}>
                로그아웃
              </button>
            </>
          )}
          {mode === 'manage' && (
            <>
              <button className="link" onClick={() => switchMode('register')}>
                + 아이 추가 등록
              </button>
              <button className="link" onClick={() => switchMode('normal')}>
                ← 뒤로가기
              </button>
            </>
          )}
          {mode === 'register' && children.length > 0 && (
            <button className="link" onClick={() => switchMode('normal')}>
              ← 뒤로가기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
