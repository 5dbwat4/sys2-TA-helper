import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { role, studentId, name } = body;

    if (role === 'student') {
      if (!studentId || !name) {
        return NextResponse.json({ error: 'Missing studentId or name' }, { status: 400 });
      }

      // Weak verification: just check if the student exists in DB and name matches
      // In a real system, the seed script will populate all valid students
      const student = await prisma.user.findFirst({
        where: {
          studentId: studentId,
          role: 'STUDENT'
        }
      });

      if (!student || student.name !== name) {
        return NextResponse.json({ error: 'Invalid credentials or student not found' }, { status: 401 });
      }

      const token = jwt.sign(
        { id: student.id, role: student.role, studentId: student.studentId, name: student.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const response = NextResponse.json({ success: true, user: student });
      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60
      });

      return response;
    }

    if (role === 'teacher') {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ error: '请输入教师姓名和密码' }, { status: 400 });
      }

      const teacherPasswords: Record<string, string> = {
        '吴磊': process.env.TEACHER_WULEI_PWD || 'ZJU-sys2_fa26@WL',
        '卢立': process.env.TEACHER_LULI_PWD || 'ZJU-sys2_fa26@LL',
      };

      if (teacherPasswords[username] && password === teacherPasswords[username]) {
        const teacherId = username === '吴磊' ? 'teacher_wulei' : 'teacher_luli';
        const teacher = await prisma.user.upsert({
          where: { studentId: teacherId },
          update: { name: username, role: 'TEACHER' },
          create: {
            studentId: teacherId,
            name: username,
            role: 'TEACHER',
          },
        });

        const token = jwt.sign(
          { id: teacher.id, role: teacher.role, studentId: teacher.studentId, name: teacher.name },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        const response = NextResponse.json({ success: true, user: teacher });
        response.cookies.set('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });

        return response;
      }

      return NextResponse.json({ error: '教师姓名或密码错误' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
