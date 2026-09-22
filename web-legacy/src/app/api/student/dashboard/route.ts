import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const student = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        boardAssignments: {
          include: { board: true },
          orderBy: { assignedAt: 'desc' }
        },
        submissions: {
          include: { experiment: true }
        },
        quizScores: {
          include: { quiz: true }
        }
      }
    });

    if (!student) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Active or latest board assignment
    const activeAssignment = student.boardAssignments[0] || null;
    let boardInfo = null;

    if (activeAssignment) {
      // Find other team members sharing this board
      const coAssignments = await prisma.boardAssignment.findMany({
        where: {
          boardId: activeAssignment.boardId,
          NOT: { studentId: student.id }
        },
        include: { student: true }
      });

      boardInfo = {
        assetNo: activeAssignment.board.assetNo,
        dbNo: activeAssignment.board.dbNo,
        contactPhone: activeAssignment.board.contactPhone,
        isReturned: activeAssignment.isReturned,
        assignedAt: activeAssignment.assignedAt,
        returnedAt: activeAssignment.returnedAt,
        teamMembers: coAssignments.map(a => a.student.name)
      };
    }

    // Query ALL experiments (both published and unpublished)
    const allExperiments = await prisma.experiment.findMany({
      orderBy: { publishDate: 'asc' }
    });

    const submissionsMap = new Map(student.submissions.map(s => [s.experimentId, s]));

    const formattedExperiments = allExperiments.map(exp => {
      const isPub = Boolean(exp.isPublished);

      if (!isPub) {
        // Unpublished experiment:
        // Student can see: number (e.g. Lab1), expected publish date, hardware/software type, weights, courseWeight
        // Student CANNOT see: actual title (redacted), due date (shows expected publish date instead), cannot interact
        // Score shown as 0 / courseWeight
        return {
          itemType: 'EXPERIMENT' as const,
          experimentId: exp.id,
          experimentNumber: exp.number,
          experimentName: null, // Title is hidden from students
          type: exp.type,
          publishDate: exp.publishDate,
          dueDate: null, // Hide due date, show publishDate as expected date
          totalScore: exp.totalScore,
          courseWeight: exp.courseWeight || 0,
          courseScore: 0,
          acceptanceRatio: exp.acceptanceRatio,
          reportRatio: exp.reportRatio,
          codeRatio: exp.codeRatio,
          isPublished: false,
          submission: null,
          status: 'UNPUBLISHED'
        };
      }

      const sub = submissionsMap.get(exp.id);
      let totalScore = null;

      if (sub) {
        if (sub.checkpointClaimed) {
          totalScore = 0;
        } else {
          const rep = sub.reportScore ?? 0;
          const code = sub.codeScore ?? 0;
          const acc = sub.acceptanceScore ?? 0;
          const raw = rep * exp.reportRatio + code * exp.codeRatio + acc * exp.acceptanceRatio;
          totalScore = Math.max(0, Math.round((raw - (sub.reportPenalty || 0) - (sub.codePenalty || 0)) * 10) / 10);
        }
      }

      return {
        itemType: 'EXPERIMENT' as const,
        experimentId: exp.id,
        experimentNumber: exp.number,
        experimentName: exp.name,
        type: exp.type,
        publishDate: exp.publishDate,
        dueDate: exp.dueDate,
        totalScore: exp.totalScore,
        courseWeight: exp.courseWeight || 0,
        courseScore: totalScore !== null ? Math.round((totalScore / 100) * (exp.courseWeight || 0) * 100) / 100 : null,
        acceptanceRatio: exp.acceptanceRatio,
        reportRatio: exp.reportRatio,
        codeRatio: exp.codeRatio,
        isPublished: true,
        submission: sub ? {
          reportScore: sub.reportScore,
          codeScore: sub.codeScore,
          acceptanceScore: sub.acceptanceScore,
          reportPenalty: sub.reportPenalty,
          codePenalty: sub.codePenalty,
          isPlagiarised: sub.isPlagiarised,
          plagiarismGroup: sub.plagiarismGroup,
          checkpointClaimed: sub.checkpointClaimed,
          remark: sub.remark,
          submitTime: sub.submitTime,
          finalScore: totalScore
        } : null,
        status: sub ? (sub.acceptanceScore !== null || sub.reportScore !== null || sub.checkpointClaimed ? 'GRADED' : 'PENDING') : 'NOT_SUBMITTED'
      };
    });

    // Query published quizzes
    const publishedQuizzes = await prisma.quiz.findMany({
      where: { isPublished: true },
      orderBy: { publishDate: 'asc' }
    });

    const quizScoreMap = new Map((student.quizScores || []).map(qs => [qs.quizId, qs]));

    const quizItems = publishedQuizzes.map(q => {
      const qs = quizScoreMap.get(q.id);
      const score = qs?.score ?? null;
      const courseScore = score !== null ? Math.round((score / q.totalScore) * q.courseWeight * 100) / 100 : null;

      return {
        itemType: 'QUIZ' as const,
        id: q.id,
        quizId: q.id,
        name: q.name,
        publishDate: q.publishDate,
        totalScore: q.totalScore,
        courseWeight: q.courseWeight,
        score,
        courseScore,
        remark: qs?.remark || null,
        status: score !== null ? 'GRADED' : 'PENDING'
      };
    });

    // Merge experiments and quizzes into a timeline sorted by publishDate
    // Rule:
    // 1. By publishDate (earlier first)
    // 2. If on the same date: Quiz takes priority over Experiment (Quiz on top)
    const toDateKey = (d: Date | string) => {
      const dt = new Date(d);
      return dt.toISOString().slice(0, 10);
    };

    const mixedTimeline = [...formattedExperiments, ...quizItems].sort((a, b) => {
      const dateA = toDateKey(a.publishDate);
      const dateB = toDateKey(b.publishDate);

      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }

      // Same day: Quiz takes precedence over Experiment
      if (a.itemType !== b.itemType) {
        return a.itemType === 'QUIZ' ? -1 : 1;
      }

      if (a.itemType === 'EXPERIMENT' && b.itemType === 'EXPERIMENT') {
        return (a.experimentNumber || '').localeCompare(b.experimentNumber || '');
      }

      return (a.name || '').localeCompare(b.name || '');
    });

    const totalEarnedCourseScore =
      formattedExperiments.reduce((acc, g) => acc + (g.courseScore || 0), 0) +
      quizItems.reduce((acc, q) => acc + (q.courseScore || 0), 0);

    const totalPossibleWeight =
      allExperiments.reduce((acc, e) => acc + (e.courseWeight || 0), 0) +
      publishedQuizzes.reduce((acc, q) => acc + (q.courseWeight || 0), 0);

    return NextResponse.json({
      success: true,
      student: {
        studentId: student.studentId,
        name: student.name,
        role: student.role,
        hasCheckpoint: student.hasCheckpoint
      },
      board: boardInfo,
      grades: formattedExperiments,
      timelineItems: mixedTimeline,
      courseSummary: {
        totalEarned: Math.round(totalEarnedCourseScore * 100) / 100,
        maxPossible: Math.round(totalPossibleWeight * 100) / 100 || 30.0
      }
    });
  } catch (error: any) {
    console.error('Student dashboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
