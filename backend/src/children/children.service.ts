import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChildDto } from './dto/create-child.dto';

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async listByParent(parentId: string) {
    const children = await this.prisma.child.findMany({
      where: { parentId },
      include: { consents: { where: { withdrawnAt: null } } },
    });
    return {
      children: children.map((c) => ({
        id: c.id,
        name: c.name,
        birthYear: c.birthYear,
        hasConsent: c.consents.length > 0,
      })),
    };
  }

  async createWithConsent(parentId: string, parentEmail: string | undefined, dto: CreateChildDto) {
    // Supabase 가입 직후에는 auth.users에만 계정이 있고 parents 표는 비어 있다.
    // upsert = "있으면 그대로, 없으면 생성" — 최초 등록 시 parents 행을 보증한다.
    await this.prisma.parent.upsert({
      where: { id: parentId },
      update: {},
      create: { id: parentId, name: parentEmail?.split('@')[0] ?? '보호자' },
    });

    const child = await this.prisma.child.create({
      data: {
        parentId,
        name: dto.name,
        birthYear: dto.birthYear,
        consents: {
          create: {
            consentVersion: dto.consent.consentVersion,
            verificationMethod: dto.consent.verificationMethod,
          },
        },
      },
    });
    return { id: child.id, name: child.name, birthYear: child.birthYear, hasConsent: true };
  }

  // 아이 + 딸린 학습 기록 전체 삭제.
  // FK 사슬(분석→대화→활동결과→세션→동의→아이) 역순으로 지우는 트랜잭션 — 전부 성공 아니면 전부 취소
  async remove(parentId: string, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException('NOT_FOUND');
    if (child.parentId !== parentId) throw new ForbiddenException('FORBIDDEN');

    await this.prisma.$transaction([
      this.prisma.utteranceAnalysis.deleteMany({
        where: { message: { session: { childId } } },
      }),
      this.prisma.message.deleteMany({ where: { session: { childId } } }),
      this.prisma.postActivityResult.deleteMany({ where: { session: { childId } } }),
      this.prisma.storySession.deleteMany({ where: { childId } }),
      this.prisma.childConsent.deleteMany({ where: { childId } }),
      this.prisma.child.delete({ where: { id: childId } }),
    ]);
    return { deleted: true };
  }
}
