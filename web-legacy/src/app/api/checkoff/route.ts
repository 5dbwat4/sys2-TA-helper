import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { getPinyinInitials } from '@/lib/pinyin';

const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'TA' && decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const experimentId = searchParams.get('experimentId');
    const q = searchParams.get('q')?.trim() || '';

    // Fetch all experiments
    const experiments = await prisma.experiment.findMany({
      orderBy: { number: 'asc' },
      include: {
        questions: {
          select: { id: true, content: true }
        }
      }
    });

    let currentExp = experiments.find(e => e.id === experimentId);
    if (!currentExp) {
      currentExp = experiments.find(e => e.isPublished) || experiments[0];
    }

    let matchedStudents: any[] = [];

    if (q) {
      const qLower = q.toLowerCase();

      // Get all students with their board assignments
      const allStudents = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        include: {
          boardAssignments: {
            where: { isReturned: false },
            orderBy: { assignedAt: 'desc' },
            include: {
              board: {
                include: {
                  assignments: {
                    where: { isReturned: false },
                    include: { student: true }
                  }
                }
              }
            }
          },
          submissions: {
            where: currentExp ? { experimentId: currentExp.id } : undefined
          }
        }
      });

      for (const st of allStudents) {
        const pinyin = getPinyinInitials(st.name);
        const activeAssignment = st.boardAssignments[0];
        const board = activeAssignment?.board;

        let matches = false;

        // 1. Student ID match (ends with or contains)
        if (st.studentId.toLowerCase().includes(qLower) || st.studentId.endsWith(q)) {
          matches = true;
        }

        // 2. Name match
        if (st.name.includes(q)) {
          matches = true;
        }

        // 3. Pinyin initials match
        if (pinyin && (pinyin.includes(qLower) || pinyin.startsWith(qLower))) {
          matches = true;
        }

        const qClean = qLower.replace(/[-\s_]/g, '');
        // 4. Board DB No / Asset No match across any active assigned board
        for (const ba of st.boardAssignments) {
          const dbClean = ba.board.dbNo.toLowerCase().replace(/[-\s_]/g, '');
          const assetClean = ba.board.assetNo.toLowerCase().replace(/[-\s_]/g, '');
          if (
            (qClean && (dbClean.includes(qClean) || assetClean.includes(qClean))) ||
            ba.board.dbNo.toLowerCase().includes(qLower) ||
            ba.board.assetNo.toLowerCase().includes(qLower)
          ) {
            matches = true;
            break;
          }
        }

        if (matches) {
          // Team members sharing this board
          const teamMembers = board
            ? board.assignments
                .map(a => a.student.name)
                .filter(name => name !== st.name)
            : [];

          const sub = st.submissions[0] || null;

          matchedStudents.push({
            id: st.id,
            studentId: st.studentId,
            name: st.name,
            pinyin,
            hasCheckpoint: st.hasCheckpoint,
            board: board ? {
              id: board.id,
              assetNo: board.assetNo,
              dbNo: board.dbNo,
              contactPhone: board.contactPhone,
              isShared: teamMembers.length > 0,
              teamMembers
            } : null,
            submission: sub ? {
              id: sub.id,
              acceptanceScore: sub.acceptanceScore,
              reportScore: sub.reportScore,
              codeScore: sub.codeScore,
              reportPenalty: sub.reportPenalty,
              codePenalty: sub.codePenalty,
              checkpointClaimed: sub.checkpointClaimed,
              remark: sub.remark
            } : null
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      experiments,
      currentExperiment: currentExp,
      matchedStudents
    });
  } catch (error: any) {
    console.error('Checkoff API error:', error);
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
      experimentId,
      studentId, // user.id or studentId
      rawAcceptanceScore, // 0-100 entered by TA
      rawCodeScore,       // 0-100 entered by TA (optional)
      checkpointClaimed = false,
      remark = null
    } = body;

    if (!experimentId || !studentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId }
    });
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    const student = await prisma.user.findFirst({
      where: {
        OR: [{ id: studentId }, { studentId: studentId }]
      }
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    let acceptanceScore: number | null = null;
    let codeScore: number | null = null;

    if (checkpointClaimed) {
      acceptanceScore = 0;
      codeScore = 0;
    } else {
      // Raw 0-100 scores entered by TA
      if (rawAcceptanceScore !== undefined && rawAcceptanceScore !== null && rawAcceptanceScore !== '') {
        acceptanceScore = Math.min(100, Math.max(0, parseFloat(rawAcceptanceScore)));
      }
      if (rawCodeScore !== undefined && rawCodeScore !== null && rawCodeScore !== '') {
        codeScore = Math.min(100, Math.max(0, parseFloat(rawCodeScore)));
      }
    }

    const submission = await prisma.submission.upsert({
      where: {
        studentId_experimentId: {
          studentId: student.id,
          experimentId: experiment.id
        }
      },
      update: {
        acceptanceScore,
        ...(codeScore !== null ? { codeScore } : {}),
        checkpointClaimed: Boolean(checkpointClaimed),
        remark: remark || (checkpointClaimed ? '申领了Checkpoint' : null)
      },
      create: {
        studentId: student.id,
        experimentId: experiment.id,
        acceptanceScore,
        codeScore: codeScore !== null ? codeScore : null,
        reportScore: null,
        checkpointClaimed: Boolean(checkpointClaimed),
        remark: remark || (checkpointClaimed ? '申领了Checkpoint' : null)
      }
    });

    // Calculate final score using ratios: acceptance (0.5), report (0.2), code (0.3)
    const accComp = (submission.acceptanceScore || 0) * experiment.acceptanceRatio;
    const repComp = (submission.reportScore || 0) * experiment.reportRatio;
    const codeComp = (submission.codeScore || 0) * experiment.codeRatio;
    const rawTotal = accComp + repComp + codeComp;
    const finalScore = checkpointClaimed ? 0 : Math.max(0, Math.round((rawTotal - (submission.reportPenalty || 0) - (submission.codePenalty || 0)) * 10) / 10);
    const courseContribution = Math.round((finalScore / 100) * (experiment.courseWeight || 0) * 100) / 100;

    return NextResponse.json({
      success: true,
      submission,
      converted: {
        acceptanceScore: submission.acceptanceScore,
        acceptanceComponent: Math.round(accComp * 10) / 10,
        codeScore: submission.codeScore,
        codeComponent: Math.round(codeComp * 10) / 10,
        finalScore,
        courseContribution,
        courseWeight: experiment.courseWeight
      }
    });
  } catch (error: any) {
    console.error('Checkoff save error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
