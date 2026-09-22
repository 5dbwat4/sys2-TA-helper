import { NextResponse } from 'next/server';
import { ZJUAM } from '@/lib/zju/zjuam';
import { prisma } from '@/lib/prisma';
import * as jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

import { TA_MAPPING } from '@/lib/constants';

const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function POST(req: Request) {
  try {
    const { studentId, password } = await req.json();
    
    // Simulate CAS login via custom library
    const am = new ZJUAM(studentId, password);
    await am.login();
    const serviceCookies = await am.loginService("https://courses.zju.edu.cn/user/index");
    
    const taName = TA_MAPPING[studentId] || 'TA User';

    // Ensure the TA exists in the DB and save ZJUAM credentials
    const user = await prisma.user.upsert({
      where: { studentId },
      update: {
        role: 'TA',
        name: taName,
        zjuamAccount: studentId,
        zjuamPassword: password,
      },
      create: {
        studentId,
        name: taName,
        role: 'TA',
        zjuamAccount: studentId,
        zjuamPassword: password,
      }
    });

    // Create JWT (clean and lightweight)
    const token = jwt.sign({ 
      id: user.id,
      studentId: user.studentId,
      name: user.name,
      role: user.role,
    }, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return NextResponse.json({ success: true, redirect: '/dashboard' });
  } catch (error: any) {
    console.error('ZJUAM login error:', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 401 });
  }
}

