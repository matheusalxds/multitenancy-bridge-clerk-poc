import { Injectable } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { EnvService } from '../env/env.service.js';

export interface VerifiedClaims {
  sub: string;
  o?: { id?: string };
}

@Injectable()
export class TokenVerifierService {
  constructor(private readonly env: EnvService) {}

  async verify(token: string): Promise<VerifiedClaims> {
    const payload = await verifyToken(token, {
      secretKey: this.env.clerkSecretKey,
      jwtKey: this.env.clerkJwtKey,
    });

    return payload as VerifiedClaims;
  }
}
