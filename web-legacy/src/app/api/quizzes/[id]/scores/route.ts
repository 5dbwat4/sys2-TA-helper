import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { getPinyinInitials } from '@/lib/pinyin';

const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/quizzes/[id]/scores
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id },
    });

    if (!quiz) {
      return NextResponse.json({ error: '小测不存在' }, { status: 404 });
    }

    // Get all students
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { studentId: 'asc' },
      select: {
        id: true,
        studentId: true,
        name: true,
      }
    });

    // Get all scores for this quiz
    const existingScores = await prisma.quizScore.findMany({
      where: { quizId: id }
    });

    const scoreMap = new Map(existingScores.map(s => [s.studentId, s]));

    const roster = students.map(st => {
      const qs = scoreMap.get(st.id);
      return {
        id: st.id,
        studentId: st.studentId,
        name: st.name,
        pinyinInitial: getPinyinInitials(st.name),
        score: qs ? qs.score : null,
        remark: qs?.remark || '',
        updatedAt: qs?.updatedAt || null,
      };
    });

    return NextResponse.json({
      success: true,
      quiz,
      roster
    });
  } catch (error: any) {
    console.error('Fetch quiz scores error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// POST /api/quizzes/[id]/scores - Continuous single entry or batch entry
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== 'TA' && user.role !== 'TEACHER')) {
      return NextResponse.json({ error: 'Forbidden: 只有老师和助教可以登记小测成绩' }, { status: 403 });
    }

    const { id: quizId } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId }
    });

    if (!quiz) {
      return NextResponse.json({ error: '小测不存在' }, { status: 404 });
    }

    const body = await req.json();

    // 1. Batch mode
    if (Array.isArray(body.entries)) {
      const updates = [];
      for (const entry of body.entries) {
        if (!entry.studentId) continue;
        const student = await prisma.user.findFirst({
          where: {
            OR: [
              { id: entry.studentId },
              { studentId: entry.studentId },
            ]
          }
        });
        if (!student) continue;

        const scoreVal = entry.score === null || entry.score === undefined || entry.score === ''
          ? null
          : parseFloat(entry.score);

        updates.push(
          prisma.quizScore.upsert({
            where: {
              quizId_studentId: {
                quizId,
                studentId: student.id,
              }
            },
            update: {
              score: scoreVal,
              remark: entry.remark ?? null,
            },
            create: {
              quizId,
              studentId: student.id,
              score: scoreVal,
              remark: entry.remark ?? null,
            }
          })
        );
      }

      await prisma.$transaction(updates);
      return NextResponse.json({ success: true, count: updates.length });
    }

    // 2. Single continuous entry mode
    const { studentId, score, remark } = body;
    if (!studentId) {
      return NextResponse.json({ error: '缺少学生学号或ID' }, { status: 400 });
    }

    const student = await prisma.user.findFirst({
      where: {
        OR: [
          { id: studentId },
          { studentId: studentId },
        ]
      }
    });

    if (!student) {
      return NextResponse.json({ error: `未找到学号或ID为 ${studentId} 的学生` }, { status: 404 });
    }

    const scoreVal = score === null || score === undefined || score === ''
      ? null
      : parseFloat(score);

    if (scoreVal !== null && isNaN(scoreVal)) {
      return NextResponse.json({ error: '分数格式无效' }, { status: 400 });
    }

    const saved = await prisma.quizScore.upsert({
      where: {
        quizId_studentId: {
          quizId,
          studentId: student.id,
        }
      },
      update: {
        score: scoreVal,
        remark: remark ?? null,
      },
      create: {
        quizId,
        studentId: student.id,
        score: scoreVal,
        remark: remark ?? null,
      }
    });

    return NextResponse.json({
      success: true,
      quizScore: saved,
      student: {
        id: student.id,
        studentId: student.studentId,
        name: student.name
      }
    });
  } catch (error: any) {
    console.error('Save quiz score error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
