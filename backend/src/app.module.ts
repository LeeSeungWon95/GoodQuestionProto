import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChildrenModule } from './children/children.module';
import { PrismaModule } from './prisma/prisma.module';
import { SessionsModule } from './sessions/sessions.module';
import { SpeechModule } from './speech/speech.module';
import { StoriesModule } from './stories/stories.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ChildrenModule,
    StoriesModule,
    SessionsModule,
    SpeechModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
