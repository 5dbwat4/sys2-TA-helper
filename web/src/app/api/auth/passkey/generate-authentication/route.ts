import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

const rpID = 'ta.alabtnt.cn';
const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET() {
  const cookieStore = await cookies();

  // For authentication, the user is not logged in yet.
  // The passkey itself provides the user handle (id).
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  });

  const challengeToken = jwt.sign({ challenge: options.challenge }, JWT_SECRET, { expiresIn: '5m' });
  
  cookieStore.set('passkey_challenge', challengeToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 300
  });

  return NextResponse.json(options);
}
