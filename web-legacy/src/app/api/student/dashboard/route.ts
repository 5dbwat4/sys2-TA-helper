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

    // Only published experiments are visible to students
    const allExperiments = await prisma.experiment.findMany({
      where: { isPublished: true },
      orderBy: { number: 'asc' }
    });

    const submissionsMap = new Map(student.submissions.map(s => [s.experimentId, s]));

    const grades = allExperiments.map(exp => {
      const sub = submissionsMap.get(exp.id);
      let totalScore = null;
      let status = 'NOT_SUBMITTED';

      if (sub) {
        status = 'GRADED';
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

    const totalEarnedCourseScore = grades.reduce((acc, g) => acc + (g.courseScore || 0), 0);

    return NextResponse.json({
      success: true,
      student: {
        studentId: student.studentId,
        name: student.name,
        role: student.role,
        hasCheckpoint: student.hasCheckpoint
      },
      board: boardInfo,
      grades,
      courseSummary: {
        totalEarned: Math.round(totalEarnedCourseScore * 100) / 100,
        maxPossible: 30.0
      }
    });
  } catch (error: any) {
    console.error('Student dashboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
