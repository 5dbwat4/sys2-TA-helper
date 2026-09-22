import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

import { TA_MAPPING } from '@/lib/constants';

const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.studentId && TA_MAPPING[decoded.studentId]) {
      decoded.name = TA_MAPPING[decoded.studentId];
    }
    return NextResponse.json({ authenticated: true, user: decoded });
  } catch (err) {
    return NextResponse.json({ authenticated: false });
  }
}
