import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';

config();

async function bootstrap() {
  let options = { cors: true };
  if (process.env.SSH_CA) {
    try {
      const ca = fs.readFileSync(process.env.SSH_CA, 'utf8');
      const privateKey = fs.readFileSync(process.env.SSH_PRIVATE || '', 'utf8');
      const cert = fs.readFileSync(process.env.SSH_CERT || '', 'utf8');

      options = Object.assign(options, {
        ca: ca,
        key: privateKey,
        cert: cert,
      });
    } catch (e) {}
  }

  const app = await NestFactory.create(AppModule, options);
  app.enableCors();
  const port = process.env.PORT || 1567;
  console.log(`Started on ${port}`);
  await app.listen(port);
}

bootstrap();
