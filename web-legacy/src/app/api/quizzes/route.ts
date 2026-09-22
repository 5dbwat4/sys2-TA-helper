import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

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

// GET /api/quizzes - List all quizzes
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quizzes = await prisma.quiz.findMany({
      orderBy: { publishDate: 'desc' },
      include: {
        scores: {
          select: {
            id: true,
            studentId: true,
            score: true,
          }
        }
      }
    });

    const totalStudents = await prisma.user.count({
      where: { role: 'STUDENT' }
    });

    const formatted = quizzes.map(q => {
      const gradedCount = q.scores.filter(s => s.score !== null).length;
      const totalScoreSum = q.scores.reduce((acc, s) => acc + (s.score || 0), 0);
      const avgScore = gradedCount > 0 ? Math.round((totalScoreSum / gradedCount) * 10) / 10 : 0;

      return {
        id: q.id,
        name: q.name,
        courseWeight: q.courseWeight,
        totalScore: q.totalScore,
        publishDate: q.publishDate,
        isPublished: q.isPublished,
        createdAt: q.createdAt,
        totalStudents,
        gradedCount,
        avgScore
      };
    });

    return NextResponse.json({ success: true, quizzes: formatted });
  } catch (error: any) {
    console.error('Fetch quizzes error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// POST /api/quizzes - Create new quiz
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== 'TA' && user.role !== 'TEACHER')) {
      return NextResponse.json({ error: 'Forbidden: 只有老师和助教可以发布小测' }, { status: 403 });
    }

    const body = await req.json();
    const { name, courseWeight, totalScore = 100, publishDate, isPublished = false } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: '小测名称不能为空' }, { status: 400 });
    }

    const parsedWeight = parseFloat(courseWeight);
    if (isNaN(parsedWeight) || parsedWeight < 0) {
      return NextResponse.json({ error: '请填写有效的小测占总评分数' }, { status: 400 });
    }

    const quiz = await prisma.quiz.create({
      data: {
        name: name.trim(),
        courseWeight: parsedWeight,
        totalScore: parseFloat(totalScore) || 100,
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        isPublished: Boolean(isPublished),
      }
    });

    return NextResponse.json({ success: true, quiz });
  } catch (error: any) {
    console.error('Create quiz error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/quizzes - Update quiz (e.g. toggle publish status or edit)
export async function PATCH(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== 'TA' && user.role !== 'TEACHER')) {
      return NextResponse.json({ error: 'Forbidden: 无权修改小测' }, { status: 403 });
    }

    const body = await req.json();
    const { id, isPublished, name, courseWeight, totalScore, publishDate } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing quiz id' }, { status: 400 });
    }

    const updateData: any = {};
    if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);
    if (name !== undefined) updateData.name = name.trim();
    if (courseWeight !== undefined) updateData.courseWeight = parseFloat(courseWeight);
    if (totalScore !== undefined) updateData.totalScore = parseFloat(totalScore);
    if (publishDate !== undefined) updateData.publishDate = new Date(publishDate);

    const updated = await prisma.quiz.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, quiz: updated });
  } catch (error: any) {
    console.error('Update quiz error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/quizzes - Delete a quiz
export async function DELETE(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== 'TA' && user.role !== 'TEACHER')) {
      return NextResponse.json({ error: 'Forbidden: 无权删除小测' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing quiz id' }, { status: 400 });
    }

    await prisma.quiz.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete quiz error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
