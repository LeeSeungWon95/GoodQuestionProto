// 콘텐츠 속 이름 자리표시자(ㅇㅇ)를 아이 이름으로 치환
// - 3글자 이름은 성+이름으로 보고 성을 뗀다 (이승원 → 승원). 2글자·4글자 이상은 별명으로 보고 유지
// - 한국어 조사 처리: 이름 끝 글자의 받침 유무로 호격(아/야)과 주격(이/생략)을 가린다

function givenName(fullName: string): string {
  const n = fullName.trim();
  return n.length === 3 ? n.slice(1) : n;
}

// 한글 음절의 받침 유무: (코드 - 0xAC00) % 28 이 0이면 받침 없음
function hasBatchim(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절이 아니면 받침 없음 취급
  return (code - 0xac00) % 28 !== 0;
}

export function personalize(text: string, childName: string): string {
  const name = givenName(childName);
  if (!name) return text;
  const last = name[name.length - 1];
  const vocative = hasBatchim(last) ? `${name}아` : `${name}야`; // ㅇㅇ아 → 민준아 / 하나야
  const subject = hasBatchim(last) ? `${name}이` : name; // ㅇㅇ이 → 민준이 / 하나

  return text.replaceAll('ㅇㅇ아', vocative).replaceAll('ㅇㅇ이', subject);
}
