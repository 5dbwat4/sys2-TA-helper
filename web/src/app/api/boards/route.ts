import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDingTalkMessage } from '@/lib/dingtalk';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

const DINGTALK_TOKEN = process.env.DINGTALK_TOKEN || '';
const DINGTALK_SECRET = process.env.DINGTALK_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const boards = await prisma.board.findMany({
      orderBy: { assetNo: 'asc' },
      include: {
        assignments: {
          include: { student: true },
          orderBy: { assignedAt: 'desc' }
        }
      }
    });

    const data = boards.map(b => {
      const active = b.assignments.find(a => !a.isReturned) || b.assignments[0] || null;
      return {
        id: b.id,
        assetNo: b.assetNo,
        dbNo: b.dbNo,
        contactPhone: b.contactPhone,
        isBorrowed: active ? !active.isReturned : false,
        currentStudent: active ? {
          studentId: active.student.studentId,
          name: active.student.name,
          assignedAt: active.assignedAt,
          isReturned: active.isReturned
        } : null
      };
    });

    return NextResponse.json({ success: true, boards: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { studentId, dbNo } = await req.json();

    if (!studentId || !dbNo) {
      return NextResponse.json({ error: 'Missing studentId or dbNo' }, { status: 400 });
    }

    const board = await prisma.board.findFirst({
      where: {
        OR: [
          { dbNo: dbNo.trim() },
          { assetNo: dbNo.trim() }
        ]
      }
    });
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const student = await prisma.user.findFirst({
      where: {
        OR: [
          { studentId: studentId.trim() },
          { id: studentId.trim() }
        ]
      }
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Check if board is already assigned to someone else
    const existingActiveAssignment = await prisma.boardAssignment.findFirst({
      where: { boardId: board.id, isReturned: false }
    });

    if (existingActiveAssignment) {
      return NextResponse.json({ error: 'Board is already currently assigned' }, { status: 400 });
    }

    const assignment = await prisma.boardAssignment.create({
      data: {
        boardId: board.id,
        studentId: student.id,
        isReturned: false
      }
    });

    if (DINGTALK_TOKEN && DINGTALK_SECRET) {
      try {
        await sendDingTalkMessage(DINGTALK_TOKEN, DINGTALK_SECRET, `[Board Assignment] Board ${board.dbNo} (${board.assetNo}) has been assigned to student ${student.studentId} (${student.name}).`);
      } catch (e) {
        console.error('DingTalk failed', e);
      }
    }

    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { dbNo } = await req.json();
    
    if (!dbNo) {
      return NextResponse.json({ error: 'Missing dbNo' }, { status: 400 });
    }

    const board = await prisma.board.findFirst({
      where: {
        OR: [
          { dbNo: dbNo.trim() },
          { assetNo: dbNo.trim() }
        ]
      }
    });
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const activeAssignments = await prisma.boardAssignment.findMany({
      where: { boardId: board.id, isReturned: false },
      include: { student: true }
    });

    if (activeAssignments.length === 0) {
      return NextResponse.json({ 
        error: `开发板 (${board.dbNo} / ${board.assetNo}) 当前处于未借出或已归还状态`,
        board: { dbNo: board.dbNo, assetNo: board.assetNo }
      }, { status: 400 });
    }

    const now = new Date();
    await prisma.boardAssignment.updateMany({
      where: { boardId: board.id, isReturned: false },
      data: {
        isReturned: true,
        returnedAt: now
      }
    });

    const students = activeAssignments.map(a => ({
      name: a.student.name,
      studentId: a.student.studentId
    }));

    // Calculate remaining unreturned boards
    const remainingCount = await prisma.boardAssignment.count({
      where: { isReturned: false }
    });

    if (DINGTALK_TOKEN && DINGTALK_SECRET) {
      try {
        await sendDingTalkMessage(
          DINGTALK_TOKEN, 
          DINGTALK_SECRET, 
          `[开发板归还登记] 板号 ${board.dbNo} (资产号: ${board.assetNo}) 已由学生 ${students.map(s => `${s.name}(${s.studentId})`).join(', ')} 成功归还。剩余未还: ${remainingCount} 块。`
        );
      } catch (e) {
        console.error('DingTalk failed', e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      board: {
        id: board.id,
        dbNo: board.dbNo,
        assetNo: board.assetNo,
        contactPhone: board.contactPhone
      },
      students,
      returnedAt: now,
      remainingCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
