import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = util.promisify(exec);
const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: experimentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'TA' && decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: { questions: true }
    });

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // Get all students
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { studentId: 'asc' },
      include: {
        submissions: {
          where: { experimentId }
        }
      }
    });

    const roster = students.map(st => {
      const sub = st.submissions[0] || null;
      let finalScore = null;
      if (sub) {
        if (sub.checkpointClaimed) {
          finalScore = 0;
        } else if (sub.acceptanceScore !== null || sub.reportScore !== null || sub.codeScore !== null) {
          const raw = (sub.acceptanceScore || 0) * experiment.acceptanceRatio +
                      (sub.reportScore || 0) * experiment.reportRatio +
                      (sub.codeScore || 0) * experiment.codeRatio;
          finalScore = Math.max(0, Math.round((raw - (sub.reportPenalty || 0) - (sub.codePenalty || 0)) * 10) / 10);
        }
      }

      return {
        id: st.id,
        studentId: st.studentId,
        name: st.name,
        hasCheckpoint: st.hasCheckpoint,
        submission: sub ? {
          id: sub.id,
          acceptanceScore: sub.acceptanceScore,
          reportScore: sub.reportScore,
          codeScore: sub.codeScore,
          reportPenalty: sub.reportPenalty,
          codePenalty: sub.codePenalty,
          isPlagiarised: sub.isPlagiarised,
          plagiarismGroup: sub.plagiarismGroup,
          checkpointClaimed: sub.checkpointClaimed,
          remark: sub.remark,
          submitTime: sub.submitTime,
          finalScore
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      experiment,
      roster
    });
  } catch (error: any) {
    console.error('Fetch grade roster error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: experimentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'TA') {
      return NextResponse.json({ error: 'Permission denied: 教师端仅有查看权限，实验批改请由助教执行' }, { status: 403 });
    }

    const body = await req.json();
    const {
      action,
      studentId,
      reportScore,
      codeScore,
      acceptanceScore,
      reportPenalty = 0,
      codePenalty = 0,
      isPlagiarised = false,
      plagiarismGroup = null,
      checkpointClaimed = false,
      remark = null
    } = body;

    if (action === 'check_plagiarism') {
      const submissionsDir = path.join(process.cwd(), '../../data/submissions', experimentId);
      const simBin = '/root/teach-assist/check/bin/sim_c++';
      
      if (!fs.existsSync(submissionsDir) || !fs.existsSync(simBin)) {
        return NextResponse.json({ 
          success: true, 
          count: 0, 
          note: 'No submission files found in data directory or sim_c++ binary uninitialized.' 
        });
      }

      try {
        const { stdout } = await execAsync(`${simBin} -p ${submissionsDir}/**/*.cpp`);
        const lines = stdout.split('\n');
        let plagiarisedStudents = new Set<string>();

        for (const line of lines) {
          const match = line.match(/(\d+)\.cpp consists for (\d+) % of (\d+)\.cpp/);
          if (match && parseInt(match[2]) > 60) {
            plagiarisedStudents.add(match[1]);
            plagiarisedStudents.add(match[3]);
          }
        }

        for (const sId of plagiarisedStudents) {
          const user = await prisma.user.findFirst({ where: { studentId: sId } });
          if (user) {
            await prisma.submission.upsert({
              where: { studentId_experimentId: { studentId: user.id, experimentId } },
              update: { isPlagiarised: true, plagiarismGroup: 'Similarity > 60%' },
              create: { studentId: user.id, experimentId, isPlagiarised: true, plagiarismGroup: 'Similarity > 60%' }
            });
          }
        }

        return NextResponse.json({ success: true, count: plagiarisedStudents.size });
      } catch (e: any) {
        console.error('sim check failed', e);
        return NextResponse.json({ error: 'Plagiarism check failed: ' + e.message }, { status: 500 });
      }
    }

    if (action === 'grade') {
      const student = await prisma.user.findFirst({
        where: {
          OR: [
            { id: studentId },
            { studentId: studentId }
          ]
        }
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      const submission = await prisma.submission.upsert({
        where: { studentId_experimentId: { studentId: student.id, experimentId } },
        update: {
          reportScore: reportScore !== null && reportScore !== undefined && reportScore !== '' ? parseFloat(reportScore) : null,
          codeScore: codeScore !== null && codeScore !== undefined && codeScore !== '' ? parseFloat(codeScore) : null,
          acceptanceScore: acceptanceScore !== null && acceptanceScore !== undefined && acceptanceScore !== '' ? parseFloat(acceptanceScore) : null,
          reportPenalty: parseFloat(reportPenalty.toString()) || 0,
          codePenalty: parseFloat(codePenalty.toString()) || 0,
          isPlagiarised: Boolean(isPlagiarised),
          plagiarismGroup: plagiarismGroup || null,
          checkpointClaimed: Boolean(checkpointClaimed),
          remark: remark || null
        },
        create: {
          studentId: student.id,
          experimentId,
          reportScore: reportScore !== null && reportScore !== undefined && reportScore !== '' ? parseFloat(reportScore) : null,
          codeScore: codeScore !== null && codeScore !== undefined && codeScore !== '' ? parseFloat(codeScore) : null,
          acceptanceScore: acceptanceScore !== null && acceptanceScore !== undefined && acceptanceScore !== '' ? parseFloat(acceptanceScore) : null,
          reportPenalty: parseFloat(reportPenalty.toString()) || 0,
          codePenalty: parseFloat(codePenalty.toString()) || 0,
          isPlagiarised: Boolean(isPlagiarised),
          plagiarismGroup: plagiarismGroup || null,
          checkpointClaimed: Boolean(checkpointClaimed),
          remark: remark || null
        }
      });

      return NextResponse.json({ success: true, submission });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Grade action error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
