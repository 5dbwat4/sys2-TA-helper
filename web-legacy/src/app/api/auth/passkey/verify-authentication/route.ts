import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { TA_MAPPING } from '@/lib/constants';

const rpID = 'ta.alabtnt.cn';
const origin = [`https://${rpID}`, `http://${rpID}`, 'http://localhost:3000', 'http://localhost:3001'];
const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function POST(req: Request) {
  const body = await req.json();
  const cookieStore = await cookies();
  const challengeToken = cookieStore.get('passkey_challenge')?.value;

  if (!challengeToken) {
    return NextResponse.json({ error: 'Missing challenge' }, { status: 400 });
  }

  let session: any;
  try {
    session = jwt.verify(challengeToken, JWT_SECRET);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid challenge' }, { status: 400 });
  }

  const passkey = await prisma.passkey.findUnique({
    where: { id: body.id },
    include: { user: true }
  });

  if (!passkey) {
    return NextResponse.json({ error: 'Passkey not found' }, { status: 404 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: session.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports ? (passkey.transports.split(',') as any[]) : undefined,
      }
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { verified, authenticationInfo } = verification;
  if (!verified) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  // Update counter
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: BigInt(authenticationInfo.newCounter) }
  });

  cookieStore.delete('passkey_challenge');

  // Issue Login Session for this user
  const displayName = TA_MAPPING[passkey.user.studentId] || passkey.user.name;
  const token = jwt.sign({ 
    id: passkey.user.id, 
    studentId: passkey.user.studentId, 
    name: displayName,
    role: passkey.user.role 
  }, JWT_SECRET, { expiresIn: '7d' });

  cookieStore.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return NextResponse.json({ verified: true, role: passkey.user.role });
}
