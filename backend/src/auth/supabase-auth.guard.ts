import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// 모든 API는 Supabase가 발급한 JWT를 Authorization: Bearer 로 받는다.
// 검증은 Supabase의 공개키(JWKS) 방식 — 프로젝트의 JWT Signing Keys(ECC)가 서명한 토큰을
// 공개 URL(/auth/v1/.well-known/jwks.json)의 공개키로 확인한다. 비밀값 불필요.
// 검증 통과 시 request.parentId 에 보호자 id(= auth.users.id = parents.id)를 심는다.
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
    const token = header.slice('Bearer '.length);

    if (!this.jwks) {
      const supabaseUrl = this.config.get<string>('SUPABASE_URL');
      if (!supabaseUrl) throw new UnauthorizedException('SUPABASE_URL not configured');
      this.jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks);
      req.parentId = payload.sub;
      req.parentEmail = (payload as { email?: string }).email; // parents 행 최초 생성 시 이름 기본값용
      return true;
    } catch {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
  }
}
