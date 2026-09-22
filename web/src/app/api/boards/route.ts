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

    // Also fetch all students for instant fast auto-complete on frontend
    const allStudents = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true, studentId: true, name: true },
      orderBy: { studentId: 'asc' }
    });

    const data = boards.map(b => {
      const activeAssignments = b.assignments.filter(a => !a.isReturned);
      const isBorrowed = activeAssignments.length > 0;
      const primary = activeAssignments[0] || b.assignments[0] || null;
      const coBorrowers = activeAssignments.slice(1).map(a => ({
        studentId: a.student.studentId,
        name: a.student.name
      }));

      return {
        id: b.id,
        assetNo: b.assetNo,
        dbNo: b.dbNo,
        contactPhone: b.contactPhone,
        isBorrowed,
        currentStudent: primary ? {
          studentId: primary.student.studentId,
          name: primary.student.name,
          assignedAt: primary.assignedAt,
          isReturned: primary.isReturned
        } : null,
        coBorrowers,
        teamMembers: coBorrowers.map(c => c.name),
        allBorrowers: activeAssignments.map(a => ({
          studentId: a.student.studentId,
          name: a.student.name
        }))
      };
    });

    return NextResponse.json({ success: true, boards: data, students: allStudents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. Single Board Creation
    if (action === 'create') {
      const { assetNo, dbNo, contactPhone } = body;
      if (!assetNo?.trim() || !dbNo?.trim()) {
        return NextResponse.json({ error: '资产编号与 DB 编号均为必填项' }, { status: 400 });
      }

      const cleanAssetNo = assetNo.trim();
      const cleanDbNo = dbNo.trim();

      // Check if board already exists
      const existing = await prisma.board.findFirst({
        where: {
          OR: [
            { assetNo: cleanAssetNo },
            { dbNo: cleanDbNo }
          ]
        }
      });

      if (existing) {
        return NextResponse.json({
          error: `开发板已存在！已有资产编号 [${existing.assetNo}] 或 DB 编号 [${existing.dbNo}]`
        }, { status: 400 });
      }

      const board = await prisma.board.create({
        data: {
          assetNo: cleanAssetNo,
          dbNo: cleanDbNo,
          contactPhone: contactPhone?.trim() || null
        }
      });

      return NextResponse.json({ success: true, board });
    }

    // 2. Batch Board Creation
    if (action === 'batch_create') {
      const { boards } = body;
      if (!Array.isArray(boards) || boards.length === 0) {
        return NextResponse.json({ error: '请提供有效的开发板列表' }, { status: 400 });
      }

      const created: any[] = [];
      const skipped: string[] = [];

      for (let i = 0; i < boards.length; i++) {
        const item = boards[i];
        const assetNo = item.assetNo?.toString().trim();
        const dbNo = item.dbNo?.toString().trim();
        const contactPhone = item.contactPhone?.toString().trim() || null;

        if (!assetNo || !dbNo) {
          skipped.push(`第 ${i + 1} 行: 资产编号或 DB 编号为空`);
          continue;
        }

        const existing = await prisma.board.findFirst({
          where: {
            OR: [{ assetNo }, { dbNo }]
          }
        });

        if (existing) {
          skipped.push(`第 ${i + 1} 行 [${assetNo} / ${dbNo}]: 已存在`);
          continue;
        }

        const b = await prisma.board.create({
          data: { assetNo, dbNo, contactPhone }
        });
        created.push(b);
      }

      return NextResponse.json({
        success: true,
        createdCount: created.length,
        created,
        skipped
      });
    }

    // 3. Assign Board to Student(s) (supports Primary Borrower, Co-borrowers, and Contact Phone)
    const { studentId, dbNo, contactPhone, coStudents } = body;
    if (!studentId || !dbNo) {
      return NextResponse.json({ error: '开发板编号与主借用人学号为必填项' }, { status: 400 });
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
      return NextResponse.json({ error: '开发板未找到，请检查 DB 编号或资产号' }, { status: 404 });
    }

    // Update board contactPhone if provided
    if (contactPhone !== undefined) {
      await prisma.board.update({
        where: { id: board.id },
        data: { contactPhone: contactPhone?.trim() || null }
      });
    }

    // Gather all students: primary + co-borrowers
    const allInputs: string[] = [studentId.trim()];
    if (Array.isArray(coStudents)) {
      for (const cs of coStudents) {
        if (typeof cs === 'string' && cs.trim()) {
          allInputs.push(cs.trim());
        } else if (cs && typeof cs === 'object' && cs.studentId) {
          allInputs.push(cs.studentId.trim());
        }
      }
    } else if (typeof coStudents === 'string' && coStudents.trim()) {
      const splitItems = coStudents.split(/[,;\s\n\t]+/).map(s => s.trim()).filter(Boolean);
      allInputs.push(...splitItems);
    }

    // Resolve students from database (by studentId or name)
    const resolvedStudents: any[] = [];
    const missingStudents: string[] = [];

    const uniqueInputs = Array.from(new Set(allInputs));
    for (const input of uniqueInputs) {
      const student = await prisma.user.findFirst({
        where: {
          role: 'STUDENT',
          OR: [
            { studentId: input },
            { name: input },
            { id: input }
          ]
        }
      });
      if (student) {
        // avoid duplicate student in array
        if (!resolvedStudents.some(s => s.id === student.id)) {
          resolvedStudents.push(student);
        }
      } else {
        missingStudents.push(input);
      }
    }

    if (missingStudents.length > 0) {
      return NextResponse.json({
        error: `以下学生未在学生库中匹配到: [${missingStudents.join(', ')}]，请确认学号或姓名是否正确`
      }, { status: 400 });
    }

    // Mark previous active assignments on this board as returned
    await prisma.boardAssignment.updateMany({
      where: { boardId: board.id, isReturned: false },
      data: {
        isReturned: true,
        returnedAt: new Date()
      }
    });

    // Create / activate assignments for all resolved students
    const assignments: any[] = [];
    const now = new Date();
    for (const st of resolvedStudents) {
      const a = await prisma.boardAssignment.upsert({
        where: {
          boardId_studentId: {
            boardId: board.id,
            studentId: st.id
          }
        },
        update: {
          isReturned: false,
          assignedAt: now,
          returnedAt: null
        },
        create: {
          boardId: board.id,
          studentId: st.id,
          isReturned: false,
          assignedAt: now
        }
      });
      assignments.push(a);
    }

    // DingTalk notification
    const studentNames = resolvedStudents.map(s => `${s.name} (${s.studentId})`).join(', ');
    const phoneInfo = contactPhone || board.contactPhone || '未登记';
    if (DINGTALK_TOKEN && DINGTALK_SECRET) {
      try {
        await sendDingTalkMessage(
          DINGTALK_TOKEN,
          DINGTALK_SECRET,
          `[开发板借出登记] 板号 ${board.dbNo} (资产号: ${board.assetNo}) 已借出给: ${studentNames}；联系电话: ${phoneInfo}`
        );
      } catch (e) {
        console.error('DingTalk failed', e);
      }
    }

    return NextResponse.json({
      success: true,
      board: { ...board, contactPhone: contactPhone || board.contactPhone },
      students: resolvedStudents,
      assignments
    });
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

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const dbNo = searchParams.get('dbNo');

    if (!id && !dbNo) {
      return NextResponse.json({ error: '请提供开发板 ID 或 DB 编号' }, { status: 400 });
    }

    const board = await prisma.board.findFirst({
      where: {
        OR: [
          ...(id ? [{ id }] : []),
          ...(dbNo ? [{ dbNo }] : [])
        ]
      },
      include: {
        assignments: {
          where: { isReturned: false }
        }
      }
    });

    if (!board) {
      return NextResponse.json({ error: '开发板不存在' }, { status: 404 });
    }

    if (board.assignments.length > 0) {
      return NextResponse.json({ error: '该开发板当前已被借出，请先归还后再删除' }, { status: 400 });
    }

    // Delete assignments history first to avoid foreign key constraints
    await prisma.boardAssignment.deleteMany({
      where: { boardId: board.id }
    });

    await prisma.board.delete({
      where: { id: board.id }
    });

    return NextResponse.json({
      success: true,
      message: `已成功删除开发板 ${board.dbNo} (${board.assetNo})`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
