import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('history/:address')
  getHistory(@Param('address') address: string): any {
    return this.appService.getHistory(address);
  }

  @Get('info')
  getInfo(): any {
    return this.appService.getInfo();
  }

  @Get('lastAddresses')
  getLastAddresses(): any {
    return this.appService.getLastAddresses();
  }

  @Get('randomAddress')
  getRandomAddress(): any {
    return this.appService.getRandomAddress();
  }
}
