import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import mongoose, { type Connection } from 'mongoose';
import { EnvService } from '../env/env.service.js';

export const MONGO_CONNECTION = Symbol('MONGO_CONNECTION');

@Global()
@Module({
  providers: [
    {
      provide: MONGO_CONNECTION,
      useFactory: (env: EnvService) =>
        mongoose.createConnection(env.mongodbUri).asPromise(),
      inject: [EnvService],
    },
  ],
  exports: [MONGO_CONNECTION],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(MONGO_CONNECTION) private readonly connection: Connection,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}
