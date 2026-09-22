import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET() {
  try {
    const experiments = await prisma.experiment.findMany({
      orderBy: { number: 'asc' },
      include: {
        _count: {
          select: { submissions: true }
        }
      }
    });
    return NextResponse.json({ success: true, experiments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'TA' && decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await req.json();
    const {
      number,
      name,
      publishDate,
      dueDate,
      totalScore = 100,
      acceptanceRatio = 0.4,
      reportRatio = 0.3,
      codeRatio = 0.3,
      type = 'HARDWARE',
      questions = []
    } = body;

    if (!number || !name || !publishDate || !dueDate) {
      return NextResponse.json({ error: 'Missing required fields (number, name, publishDate, dueDate)' }, { status: 400 });
    }

    const experiment = await prisma.experiment.create({
      data: {
        number,
        name,
        publishDate: new Date(publishDate),
        dueDate: new Date(dueDate),
        totalScore: parseFloat(totalScore.toString()),
        acceptanceRatio: parseFloat(acceptanceRatio.toString()),
        reportRatio: parseFloat(reportRatio.toString()),
        codeRatio: parseFloat(codeRatio.toString()),
        type,
        isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : false,
        questions: questions.length > 0 ? {
          create: questions.map((q: string) => ({ content: q }))
        } : undefined
      }
    });

    return NextResponse.json({ success: true, experiment });
  } catch (error: any) {
    console.error('Create experiment error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'TA' && decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id, isPublished, syncZju } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing experiment id' }, { status: 400 });
    }

    const experiment = await prisma.experiment.update({
      where: { id },
      data: {
        isPublished: Boolean(isPublished)
      }
    });

    let syncResult = null;
    if (syncZju && isPublished) {
      try {
        const { ZJUAM } = await import('@/lib/zju/zjuam');
        const { ZJUCourses, TARGET_COURSE_ID } = await import('@/lib/zju/zju_courses');
        const taUser = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (taUser?.zjuamAccount && taUser?.zjuamPassword) {
          const am = new ZJUAM(taUser.zjuamAccount, taUser.zjuamPassword);
          await am.login();
          const serviceCookies = await am.loginService("https://courses.zju.edu.cn/user/index");
          const zjuCourses = new ZJUCourses(serviceCookies);
          syncResult = await zjuCourses.createExperimentDualHomeworks(TARGET_COURSE_ID, experiment, true);
        }
      } catch (err: any) {
        console.warn('Sync to ZJU courses warning:', err.message);
        syncResult = { error: err.message };
      }
    }

    return NextResponse.json({ success: true, experiment, syncResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
