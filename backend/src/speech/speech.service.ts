import { Injectable, NotImplementedException, UnprocessableEntityException } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class SpeechService {
  private readonly openai = new OpenAI(); // OPENAI_API_KEY 환경변수 사용

  // 음성 → 텍스트. 원본 음성은 변환 후 즉시 폐기 (저장 금지 — D-06)
  async transcribe(audio: Express.Multer.File) {
    if (!audio?.buffer?.length) throw new UnprocessableEntityException('STT_FAILED');
    // TODO: this.openai.audio.transcriptions.create() — webm/mp4(iPad) 포맷 분기
    //       인식 실패·빈 결과 시 422 STT_FAILED (messages 미생성 규칙)
    throw new NotImplementedException();
  }

  // 캐릭터 대사 TTS. 고정 대사는 캐싱 대상 (R-03 지연 대응)
  async speakMessage(messageId: string) {
    // TODO: messages에서 텍스트 조회 → this.openai.audio.speech.create() → 오디오 스트림 반환
    throw new NotImplementedException();
  }
}
