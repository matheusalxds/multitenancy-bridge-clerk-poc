import { Controller, Get, Req } from '@nestjs/common';
import { EntityNotFoundError } from '../common/domain-errors.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import type { PlatformUser } from './user.schema.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async findMe(@Req() request: AuthenticatedRequest): Promise<PlatformUser> {
    const clerkUserId = request.userId ?? '';
    const user = await this.usersService.findByClerkUserId(clerkUserId);

    if (!user) {
      throw new EntityNotFoundError('User', clerkUserId);
    }

    return user;
  }
}
