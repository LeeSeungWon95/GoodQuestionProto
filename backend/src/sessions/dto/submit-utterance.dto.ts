import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitUtteranceDto {
  @IsString()
  @IsNotEmpty()
  text: string; // 아이가 [보내기]로 확정한 발화

  @IsOptional()
  @IsString()
  sttRawText?: string; // STT 최초 변환 결과

  @IsOptional()
  @IsString()
  missionId?: string; // 미션 수행 발화일 때 (Q-06 확정 후 저장 방식 반영)
}
