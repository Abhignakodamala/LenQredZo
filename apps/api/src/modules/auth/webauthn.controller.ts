import prisma from '../../lib/prisma';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in the environment.');

const RP_NAME = process.env.RP_NAME || 'LenQredzo';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';
const CHALLENGE_TTL = 5 * 60 * 1000;

type ChallengeEntry = { userId?: number; email?: string; challenge: string; expiresAt: number };
const challengeStore = new Map<string, ChallengeEntry>();

const encode = (value: Buffer) => value.toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url');

function rememberChallenge(entry: Omit<ChallengeEntry, 'expiresAt'>) {
  const key = entry.challenge;
  challengeStore.set(key, { ...entry, expiresAt: Date.now() + CHALLENGE_TTL });
  return key;
}

function consumeChallenge(key: string, expectedUserId?: number, expectedEmail?: string) {
  const entry = challengeStore.get(key);
  challengeStore.delete(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  if (expectedUserId !== undefined && entry.userId !== expectedUserId) return null;
  if (expectedEmail !== undefined && entry.email !== expectedEmail) return null;
  return entry;
}

function makeToken(user: { id: number; role: string; companyId: number | null; branchId: number | null }) {
  return jwt.sign(
    { userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function safeUser(user: { id: number; name: string; email: string; role: string; companyId: number | null }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId };
}

function parseTransports(value: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as string[];
  } catch {
    return undefined;
  }
}

function passkeyView(passkey: { id: string; nickname: string | null; deviceType: string | null; createdAt: Date; lastUsedAt: Date | null }) {
  return {
    id: passkey.id,
    nickname: passkey.nickname,
    deviceType: passkey.deviceType,
    createdAt: passkey.createdAt,
    lastUsedAt: passkey.lastUsedAt,
  };
}

export const beginRegistration = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { passkeys: true } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(String(user.id)),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: user.passkeys.map(passkey => ({
        id: passkey.credentialId,
        transports: parseTransports(passkey.transports) as any,
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });

    rememberChallenge({ userId: user.id, challenge: options.challenge });
    res.json(options);
  } catch (error) {
    console.error('WEBAUTHN REGISTRATION OPTIONS ERROR:', error);
    res.status(500).json({ message: 'Unable to start biometric setup' });
  }
};

export const completeRegistration = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const response = req.body as RegistrationResponseJSON;
    const clientChallenge = JSON.parse(decode(response.response.clientDataJSON).toString()).challenge;
    const expected = consumeChallenge(clientChallenge, user.id);
    if (!expected) return res.status(400).json({ message: 'Registration session expired. Try again.' });

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: expected.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ message: 'Biometric registration was not verified' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: encode(Buffer.from(credential.id)),
        publicKey: encode(Buffer.from(credential.publicKey)),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: response.response.transports ? JSON.stringify(response.response.transports) : null,
        nickname: req.body.nickname || req.headers['x-device-name'] || 'This device',
      },
    });
    res.json({ message: 'Biometric login enabled' });
  } catch (error: any) {
    console.error('WEBAUTHN REGISTRATION VERIFY ERROR:', error);
    res.status(500).json({ message: error.message || 'Unable to save biometric login' });
  }
};

export const beginAuthentication = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await prisma.user.findUnique({ where: { email }, include: { passkeys: true } });
    if (!user || user.passkeys.length === 0) {
      return res.status(404).json({ message: 'No biometric login is set up for this account. Sign in with your password first, then enable it in Settings.' });
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: user.passkeys.map(passkey => ({
        id: passkey.credentialId,
        transports: parseTransports(passkey.transports) as any,
      })),
      userVerification: 'preferred',
    });
    rememberChallenge({ email, userId: user.id, challenge: options.challenge });
    res.json(options);
  } catch (error) {
    console.error('WEBAUTHN AUTH OPTIONS ERROR:', error);
    res.status(500).json({ message: 'Unable to start biometric login' });
  }
};

export const completeAuthentication = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const response = req.body.response as AuthenticationResponseJSON;
    if (!email || !response) return res.status(400).json({ message: 'Email and biometric response are required' });

    const user = await prisma.user.findUnique({ where: { email }, include: { passkeys: true } });
    if (!user) return res.status(400).json({ message: 'Biometric login failed' });
    const clientChallenge = JSON.parse(decode(response.response.clientDataJSON).toString()).challenge;
    const expected = consumeChallenge(clientChallenge, user.id, email);
    if (!expected) return res.status(400).json({ message: 'Authentication session expired. Try again.' });

    const passkey = user.passkeys.find(item => item.credentialId === response.id);
    if (!passkey) return res.status(400).json({ message: 'This biometric credential is not registered' });

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: expected.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: decode(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: parseTransports(passkey.transports) as any,
      },
    });
    if (!verification.verified) return res.status(400).json({ message: 'Biometric verification failed' });

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
    });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (error: any) {
    console.error('WEBAUTHN AUTH VERIFY ERROR:', error);
    res.status(500).json({ message: error.message || 'Biometric login failed' });
  }
};

export const listPasskeys = async (req: any, res: Response) => {
  const passkeys = await prisma.passkey.findMany({ where: { userId: req.user.userId }, orderBy: { createdAt: 'desc' } });
  res.json(passkeys.map(passkeyView));
};

export const deletePasskey = async (req: any, res: Response) => {
  const passkey = await prisma.passkey.findFirst({ where: { id: req.params.id, userId: req.user.userId } });
  if (!passkey) return res.status(404).json({ message: 'Passkey not found' });
  await prisma.passkey.delete({ where: { id: passkey.id } });
  res.json({ message: 'Biometric login removed' });
};
