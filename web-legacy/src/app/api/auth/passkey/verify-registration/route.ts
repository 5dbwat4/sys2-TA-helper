import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

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

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: session.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { verified, registrationInfo } = verification;
  if (!verified || !registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

  await prisma.passkey.create({
    data: {
      id: credential.id,
      userId: session.userId,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports ? credential.transports.join(',') : null,
    }
  });

  cookieStore.delete('passkey_challenge');
  return NextResponse.json({ verified: true });
}
