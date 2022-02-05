import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MoralisService } from './moralis/moralis.service';
import { PricesService } from './prices/prices.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, MoralisService, PricesService],
})
export class AppModule {}
