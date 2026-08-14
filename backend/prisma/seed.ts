// 시드 데이터: MVP 콘텐츠 「방귀 뀌는 며느리」 (팀 노션 콘텐츠 문서 기준)
// 실행: npm run db:seed
//
// 팀 확인 필요 (docs/04-decisions-risks.md):
//  - Q-05: 대화1·2의 required_elements는 문서 내 두 표가 불일치 — 장면 구성 테이블 기준으로 입력
//  - preferred_turns는 콘텐츠 문서에 없어 임시값(2) — 확정 시 수정
//  - post_activity_config의 카드 문구·핵심 단어는 초안 — 콘텐츠 담당 확인 필요

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const story = await prisma.story.create({
    data: {
      title: '방귀 뀌는 며느리',
      summary: '큰 방귀를 부끄러워하던 며느리가 자신의 다름을 장점으로 바꾸는 이야기',
      difficulty: '보통',
      topics: ['다름', '자기이해', '장점 발견'],
      estimatedMinutes: 20,
      status: 'published',
      postActivityConfig: {
        cards: [
          { id: 'card_1', text: '며느리는 방귀를 꾹꾹 참았어요.', correct_order: 1 },
          { id: 'card_2', text: '참았던 방귀가 크게 터져 나왔어요.', correct_order: 2 },
          { id: 'card_3', text: '시아버지가 화가 나서 며느리를 친정에 데려가려 했어요.', correct_order: 3 },
          { id: 'card_4', text: '며느리가 방귀로 높은 배나무의 배를 떨어뜨렸어요.', correct_order: 4 },
          { id: 'card_5', text: '시아버지가 사과하고 며느리는 방귀를 특별한 힘으로 여기게 됐어요.', correct_order: 5 },
        ],
        retelling_keywords: ['방귀', '며느리', '시아버지', '배나무'],
      },
      scenes: {
        create: [
          {
            sceneOrder: 1,
            sceneType: 'intro',
            sceneDescription:
              '옛날 어느 마을에 방귀를 아주 크게 뀌는 며느리가 살았습니다. 며느리는 시집에 온 뒤로 늘 얌전하고 예의 바르게 보이고 싶었습니다. 시댁 식구들이 자신을 이상하게 볼까 봐 걱정했기 때문입니다.',
          },
          {
            sceneOrder: 2,
            sceneType: 'story',
            sceneDescription:
              '그래서 며느리는 방귀가 나오려고 할 때마다 꾹꾹 참았습니다. 하루도 참고, 이틀도 참고, 그렇게 오래 참다 보니 배는 점점 빵빵하게 부풀어 올랐고 얼굴은 노랗게 변했습니다. 몸도 마음도 너무 힘들었지만, 며느리는 차마 가족들에게 솔직하게 말하지 못했습니다.',
          },
          {
            sceneOrder: 3,
            sceneType: 'dialogue',
            characterName: '방귀쟁이 며느리',
            conflict: '방귀를 참자니 몸이 힘들고, 솔직하게 말하자니 가족들이 이상하게 볼까 봐 두렵다.',
            characterOpening: 'ㅇㅇ아, 내 방귀가 너무 크다는 걸 알면 가족들이 나를 이상하게 생각하지 않을까?',
            characterClosing: '그래도 아직은 못 말하겠어. 조금만 더 참아 볼게.',
            sceneGoal:
              '방귀를 숨기고 싶어하는 며느리의 입장을 이해하고, 공감해주며 문제를 숨기지 않고 솔직하게 말할 수 있는 용기를 준다',
            requiredElements: ['PERSPECTIVE', 'EMOTION', 'REASON', 'SOLUTION'],
            preferredTurns: 2,
            maxTurns: 4,
          },
          {
            sceneOrder: 4,
            sceneType: 'story',
            sceneDescription:
              '며느리는 더 이상 참을 수 없어 몰래 살짝만 방귀를 뀌려고 합니다. 하지만 오래 참았던 탓에 방귀가 크게 터져 나왔습니다. 마당의 먼지가 휘리릭 날아가고, 기왓장이 달그락거리고, 시아버지의 갓까지 휙 날아가 버렸습니다.',
          },
          {
            sceneOrder: 5,
            sceneType: 'dialogue',
            characterName: '시아버지',
            conflict: '며느리의 방귀에 놀라고 화가 나서 함께 살 수 없다고 생각한다.',
            characterOpening:
              '아이고 이게 무슨 일이냐! 우리 집안이 다 흔들리는구나! 이렇게 창피한 며느리와 함께 못살겠다! 그렇지 않니?',
            characterClosing: '흥, 그래도 도저히 이런 며느리와는 함께 살 수 없으니 친정으로 데려다줘야겠다.',
            sceneGoal:
              '시아버지가 놀란 마음을 이해하면서도, 며느리가 일부러 그런 것이 아니라 오래 참아서 힘들었던 것임을 말하고, 며느리를 따뜻하게 이해해 달라고 설득한다.',
            requiredElements: ['PERSPECTIVE', 'EMOTION', 'REASON', 'SOLUTION'],
            preferredTurns: 2,
            maxTurns: 5,
          },
          {
            sceneOrder: 6,
            sceneType: 'story',
            sceneDescription:
              '한참 걷다 보니 아랫마을 길가에 아주 높은 배나무가 한 그루 서 있었습니다. 나무 꼭대기에는 노랗고 탐스러운 배들이 주렁주렁 매달려 있었습니다. 시아버지는 배를 보자 군침이 돌았습니다. 마침 아랫마을 사람들도 그 배를 먹고 싶어 했지만, 나무가 너무 높아 아무도 딸 수 없었습니다.',
          },
          {
            sceneOrder: 7,
            sceneType: 'dialogue',
            characterName: '마을 이장',
            conflict: '탐스러운 배가 열렸지만 나무가 너무 높아 아무도 딸 수 없다.',
            characterOpening:
              '이 배나무는 해마다 탐스러운 배가 열리지만, 너무 높아서 아무도 딸 수가 없었소. 무슨 뾰족한 방법이 없겠는가?',
            characterClosing: '아이고, 방귀 뀌는 며느리 덕분에 온 마을이 배 잔치를 할 수 있겠구려, 고맙소!',
            sceneGoal:
              '높은 배나무의 배를 떨어뜨릴 방법을 생각하고, 며느리의 큰 방귀를 안전하게 사용할 수 있는 해결책을 제안한다. (미션1: 높이 있는 배 따기)',
            requiredElements: ['SOLUTION', 'REASON', 'REQUEST', 'RESULT'],
            preferredTurns: 2,
            maxTurns: 5,
          },
          {
            sceneOrder: 8,
            sceneType: 'story',
            sceneDescription:
              '시아버지는 며느리의 방귀가 시끄럽고 별난 것이 아니라, 모두를 도울 수 있는 특별한 힘이라는 것을 깨닫습니다. 자신이 며느리를 구박했던 일을 후회하고 사과합니다.',
          },
          {
            sceneOrder: 9,
            sceneType: 'dialogue',
            characterName: '방귀쟁이 며느리',
            conflict: '숨기고 싶던 특징이 도움이 된다는 것을 알게 되어 마음이 변하고 있다.',
            characterOpening:
              'ㅇㅇ이 덕분에 내 방귀가 누군가에게 도움이 될 수 있다는 걸 처음 알았어. 이제는 방귀 소리가 큰 걸 부끄러워하지 않아도 될까?',
            characterClosing: '이제는 부끄러워하며 숨기지 않고, 조심해서 좋은 일에 써 볼게',
            sceneGoal:
              '다름을 인정하고, 자신의 특징을 긍정적으로 받아들이는 태도를 말한다. (미션2: 친구들의 단점을 장점으로 바꾸기)',
            requiredElements: ['EMOTION', 'PERSPECTIVE', 'RESULT', 'SOLUTION'],
            preferredTurns: 2,
            maxTurns: 4,
          },
        ],
      },
    },
  });
  console.log(`seeded story: ${story.title} (${story.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
