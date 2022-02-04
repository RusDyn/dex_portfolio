import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MoralisService } from './moralis/moralis.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, MoralisService],
})
export class AppModule {}
