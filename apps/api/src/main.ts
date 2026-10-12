import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { EnvService } from './env/env.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const env = app.get(EnvService);
  await app.listen(env.port);
}

await bootstrap();
