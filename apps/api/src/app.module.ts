import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { validateApiEnv } from '@poc/env-config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { GlobalExceptionFilter } from './common/global-exception.filter.js';
import { DatabaseModule } from './database/database.module.js';
import { EnvModule } from './env/env.module.js';
import { LoanApplicationsModule } from './loan-applications/loan-applications.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'local'}`, '.env'],
      validate: validateApiEnv,
    }),
    EnvModule,
    DatabaseModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    TenancyModule,
    LoanApplicationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule {}
