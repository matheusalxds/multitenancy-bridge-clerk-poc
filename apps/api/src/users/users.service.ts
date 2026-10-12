import { Inject, Injectable } from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { MONGO_CONNECTION } from '../database/database.module.js';
import { EnvService } from '../env/env.service.js';
import { USER_MODEL, type PlatformUser, userSchema } from './user.schema.js';

const USER_CACHE_TTL_MS = 60_000;

interface CachedUser {
  user: PlatformUser;
  expiresAt: number;
}

@Injectable()
export class UsersService {
  private readonly userModel: Model<PlatformUser>;
  private readonly userCache = new Map<string, CachedUser>();

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

  async findByClerkUserId(clerkUserId: string): Promise<PlatformUser | null> {
    const cached = this.userCache.get(clerkUserId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const user = await this.userModel.findOne({ clerkUserId }).lean().exec();

    if (user) {
      this.userCache.set(clerkUserId, {
        user,
        expiresAt: Date.now() + USER_CACHE_TTL_MS,
      });
    }

    return user;
  }
}
