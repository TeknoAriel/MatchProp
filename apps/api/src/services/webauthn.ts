import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

const CHALLENGE_EXPIRY_MIN = 5;

function toBase64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}

function fromBase64url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64url'));
}

export async function createRegistrationOptions(email?: string, userId?: string) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const challengeStr = toBase64url(challenge);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CHALLENGE_EXPIRY_MIN);

  await prisma.webAuthnChallenge.create({
    data: {
      challenge: challengeStr,
      email: email ?? null,
      userId: userId ?? null,
      expiresAt,
    },
  });

  const options = await generateRegistrationOptions({
    rpName: config.webauthnRpName,
    rpID: config.webauthnRpId,
    userID: userId ? Buffer.from(userId, 'utf8') : undefined,
    userName: email ?? 'passkey-user',
    challenge,
    excludeCredentials: [],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  return { options, challengeStr };
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string
) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.webauthnOrigin,
    expectedRPID: config.webauthnRpId,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return null;
  }

  const info = verification.registrationInfo;
  const credentialID = info.credentialID;
  const credentialPublicKey = info.credentialPublicKey;
  const counter = info.counter;
  const credentialIdStr =
    typeof credentialID === 'string' ? credentialID : toBase64url(credentialID);
  const publicKeyStr =
    typeof credentialPublicKey === 'string'
      ? credentialPublicKey
      : toBase64url(credentialPublicKey);
  return {
    credentialId: credentialIdStr,
    publicKey: publicKeyStr,
    counter,
  };
}

export async function createAuthenticationOptions(email?: string) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const challengeStr = toBase64url(challenge);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CHALLENGE_EXPIRY_MIN);

  await prisma.webAuthnChallenge.create({
    data: {
      challenge: challengeStr,
      email: email ?? null,
      expiresAt,
    },
  });

  let allowCredentials: { id: string }[] | undefined;
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const creds = await prisma.passkeyCredential.findMany({
        where: { userId: user.id },
        select: { credentialId: true },
      });
      allowCredentials = creds.map((c) => ({ id: c.credentialId }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: config.webauthnRpId,
    challenge,
    allowCredentials,
    userVerification: 'preferred',
  });

  return { options, challengeStr };
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string
) {
  const credentialId = response.id;
  const credential = await prisma.passkeyCredential.findUnique({
    where: { credentialId },
    include: { user: true },
  });
  if (!credential) return null;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.webauthnOrigin,
    expectedRPID: config.webauthnRpId,
    authenticator: {
      credentialID: credential.credentialId,
      credentialPublicKey: fromBase64url(credential.publicKey),
      counter: credential.counter,
    },
  });

  if (!verification.verified) return null;

  const newCounter = verification.authenticationInfo?.newCounter ?? credential.counter;
  await prisma.passkeyCredential.update({
    where: { id: credential.id },
    data: { counter: newCounter, lastUsedAt: new Date() },
  });

  return {
    userId: credential.userId,
    email: credential.user.email,
    role: credential.user.role,
  };
}

export async function consumeChallenge(challengeStr: string) {
  const now = new Date();
  const record = await prisma.webAuthnChallenge.findUnique({
    where: { challenge: challengeStr },
  });
  if (!record || record.expiresAt < now) return null;
  await prisma.webAuthnChallenge.delete({ where: { id: record.id } });
  return record;
}
