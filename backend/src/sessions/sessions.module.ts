import { Module } from '@nestjs/common';
import { SpeechModule } from '../speech/speech.module';
import { DialogueEngineService } from './dialogue-engine.service';
import { PostActivityController } from './post-activity.controller';
import { PostActivityService } from './post-activity.service';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [SpeechModule],
  controllers: [SessionsController, PostActivityController],
  providers: [SessionsService, DialogueEngineService, PostActivityService],
})
export class SessionsModule {}
