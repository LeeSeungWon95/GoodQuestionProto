import { createClient } from '@supabase/supabase-js';

// 가입·로그인은 이 클라이언트로 직접 처리 (백엔드 경유 없음 — docs/07-api-design.md)
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
