import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { ChildInfo } from '../lib/types';

// 아이 선택 화면 (FR-01) — 화면 흐름도: 로그인 → 아이 선택 → 홈
// 등록된 아이가 없으면 등록 폼을 보여준다. 등록 시 개인정보 동의 필수 (child_consents).
export default function ChildSelectPage({ onSelect }: { onSelect: (child: ChildInfo) => void }) {
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false); // 관리(삭제) 모드
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState(2018);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadChildren() {
    try {
      const res = await api<{ children: ChildInfo[] }>('/children');
      setChildren(res.children);
      setShowForm(res.children.length === 0); // 아이가 없으면 바로 등록 폼
      if (res.children.length === 0) setEditing(false); // 관리할 대상이 없으면 관리 모드 해제
    } catch (e) {
      setError(e instanceof ApiError ? `오류 ${e.status}: ${e.code}` : String(e));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await loadChildren();
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
      setShowForm(false);
      await loadChildren();
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
        <p className="sub">아이를 선택하거나 새로 등록하세요</p>

        {children.map((c) => (
          <div key={c.id} className="childrow">
            <button className="child" onClick={() => onSelect(c)} disabled={editing || busy}>
              <strong>{c.name}</strong>
              <span className="meta">{c.birthYear}년생</span>
            </button>
            {editing && (
              <button className="delbtn" onClick={() => removeChild(c)} disabled={busy}>
                삭제
              </button>
            )}
          </div>
        ))}

        {children.length > 0 && (
          <button
            className="link"
            onClick={() => {
              setEditing(!editing);
              setShowForm(false); // 관리 모드와 등록 폼은 동시에 열리지 않음
              setError('');
            }}
          >
            {editing ? '관리 끝내기' : '프로필 관리 (삭제)'}
          </button>
        )}

        {showForm ? (
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
        ) : (
          <button
            className="link"
            onClick={() => {
              setShowForm(true);
              setEditing(false); // 등록 폼을 열면 관리 모드 종료
            }}
          >
            + 아이 추가 등록
          </button>
        )}

        {error && <p className="msg">{error}</p>}

        <button className="link" onClick={() => supabase.auth.signOut()}>
          로그아웃
        </button>
      </div>
    </main>
  );
}
