import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('token');
  cookieStore.delete('passkey_challenge');

  const response = NextResponse.json({ success: true });
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.delete('token');
  response.cookies.delete('passkey_challenge');
  return response;
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  cookieStore.delete('token');
  cookieStore.delete('passkey_challenge');

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'ta.alabtnt.cn';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const redirectUrl = `${proto}://${host}/login`;

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.delete('token');
  response.cookies.delete('passkey_challenge');
  return response;
}
