// 테스트 계정 생성 (이메일 인증 없이 바로 로그인 가능)
// 실행: npm run auth:test-user            → admin@test.com / 1234
//       npm run auth:test-user -- a@b.com pw → 원하는 계정
//
// Supabase Auth 관리자 API(service_role 키)로 auth.users에 직접 넣는다.
//  - email_confirm: true → 인증 메일 절차 생략
//  - parents 행은 첫 아이 등록 시 서버가 upsert 하므로 여기서 만들지 않는다 (children.service.ts)
//  - service_role 키는 모든 권한을 가지므로 서버 .env에만 두고 절대 프론트·커밋에 노출 금지

import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2] ?? 'admin@test.com';
const password = process.argv[3] ?? '1234';

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      '❌ backend/.env 에 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.\n' +
        '   키 위치: Supabase 대시보드 → Project Settings → API Keys → service_role (secret)',
    );
    process.exit(1);
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.ok) {
    console.log(`✅ 생성 완료  이메일: ${email}  비밀번호: ${password}  id: ${body.id}`);
    return;
  }

  const msg = String(body.msg ?? body.message ?? body.error_description ?? JSON.stringify(body));

  if (res.status === 422 && /already|exists|registered/i.test(msg)) {
    console.log(`ℹ️ 이미 존재하는 계정입니다: ${email} — 그대로 로그인하면 됩니다.`);
    return;
  }
  if (res.status === 422 && /password/i.test(msg)) {
    console.error(
      `❌ 비밀번호 규칙 위반: ${msg}\n` +
        '   해결 ① 대시보드 → Authentication → Sign In / Providers → Email → Minimum password length 를 4로 낮춘 뒤 재실행\n' +
        '   해결 ② 더 긴 비밀번호로 생성: npm run auth:test-user -- admin@test.com 12341234',
    );
    process.exit(1);
  }
  console.error(`❌ 실패 (${res.status}): ${msg}`);
  process.exit(1);
}

main();
