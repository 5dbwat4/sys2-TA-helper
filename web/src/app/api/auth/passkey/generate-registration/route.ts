import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

const rpName = 'ZJU TA System';
const rpID = 'ta.alabtnt.cn';
const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let userSession;
  try {
    userSession = jwt.verify(token, JWT_SECRET) as any;
  } catch (err) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { studentId: userSession.studentId } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  
  const userPasskeys = await prisma.passkey.findMany({ where: { userId: user.id } });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from(user.id)),
    userName: user.studentId,
    attestationType: 'none',
    excludeCredentials: userPasskeys.map(passkey => ({
      id: passkey.id,
      transports: passkey.transports ? (passkey.transports.split(',') as any[]) : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  const challengeToken = jwt.sign({ challenge: options.challenge, userId: user.id }, JWT_SECRET, { expiresIn: '5m' });
  
  cookieStore.set('passkey_challenge', challengeToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 300 // 5 minutes
  });

  return NextResponse.json(options);
}
