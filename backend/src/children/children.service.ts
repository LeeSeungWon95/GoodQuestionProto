import { Injectable } from '@nestjs/common';
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
}
