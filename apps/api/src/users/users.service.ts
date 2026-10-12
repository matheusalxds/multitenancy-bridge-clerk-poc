import { Inject, Injectable } from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { MONGO_CONNECTION } from '../database/database.module.js';
import { EnvService } from '../env/env.service.js';
import { USER_MODEL, type PlatformUser, userSchema } from './user.schema.js';

@Injectable()
export class UsersService {
  private readonly userModel: Model<PlatformUser>;

  constructor(
    @Inject(MONGO_CONNECTION) connection: Connection,
    env: EnvService,
  ) {
    const platformDb = connection.useDb(env.platformDbName, {
      useCache: true,
    });

    this.userModel =
      (platformDb.models[USER_MODEL] as Model<PlatformUser> | undefined) ??
      platformDb.model<PlatformUser>(USER_MODEL, userSchema);
  }

  findByClerkUserId(clerkUserId: string): Promise<PlatformUser | null> {
    return this.userModel.findOne({ clerkUserId }).lean().exec();
  }
}
