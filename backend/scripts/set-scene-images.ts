// 장면 이미지 경로를 DB에 연결하는 유틸리티
// 실행: npx tsx scripts/set-scene-images.ts
// (이미지 실물은 frontend/public/scenes/scene-N.webp — 프론트가 정적 서빙)

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const story = await prisma.story.findFirst({ where: { title: '방귀 뀌는 며느리' } });
  if (!story) throw new Error('story not found');

  for (let i = 1; i <= 9; i++) {
    await prisma.storyScene.updateMany({
      where: { storyId: story.id, sceneOrder: i },
      data: { imageUrl: `/scenes/scene-${i}.webp` },
    });
  }

  const check = await prisma.storyScene.findMany({
    where: { storyId: story.id },
    orderBy: { sceneOrder: 'asc' },
    select: { sceneOrder: true, imageUrl: true },
  });
  console.table(check);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
