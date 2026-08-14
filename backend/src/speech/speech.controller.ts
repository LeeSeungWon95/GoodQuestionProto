import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SpeechService } from './speech.service';

@Controller('speech')
@UseGuards(SupabaseAuthGuard)
export class SpeechController {
  constructor(private readonly speech: SpeechService) {}

  // POST /api/v1/speech/stt — 변환만, 저장 없음 (아이가 [보내기]로 확정하기 전)
  @Post('stt')
  @UseInterceptors(FileInterceptor('audio'))
  stt(@UploadedFile() audio: Express.Multer.File) {
    return this.speech.transcribe(audio);
  }

  // GET /api/v1/speech/tts/:messageId — 캐릭터 대사 음성 (다시 듣기 포함)
  @Get('tts/:messageId')
  tts(@Param('messageId', ParseUUIDPipe) messageId: string) {
    return this.speech.speakMessage(messageId);
  }
}
