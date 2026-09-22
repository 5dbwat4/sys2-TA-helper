import { prisma } from "@/lib/prisma";
import { requireStaff, withAuth } from "@/lib/auth";
import { sendDingTalkMessage } from "@/lib/dingtalk";
import { env } from "@/lib/env";

async function notifyDingTalk(text: string) {
  if (!env.dingtalkToken || !env.dingtalkSecret) return;
  try {
    await sendDingTalkMessage(env.dingtalkToken, env.dingtalkSecret, text);
  } catch (e) {
    console.error("DingTalk notification failed:", e);
  }
}

export const GET = withAuth(async () => {
  await requireStaff();

  const [boards, students] = await Promise.all([
    prisma.board.findMany({
      orderBy: { assetNo: "asc" },
      include: {
        assignments: { include: { student: true }, orderBy: { assignedAt: "desc" } },
      },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, studentId: true, name: true },
      orderBy: { studentId: "asc" },
    }),
  ]);

  const data = boards.map((b) => {
    const active = b.assignments.filter((a) => !a.isReturned);
    const primary = active[0] ?? b.assignments[0] ?? null;
    const coBorrowers = active.slice(1).map((a) => ({
      studentId: a.student.studentId,
      name: a.student.name,
    }));
    return {
      id: b.id,
      assetNo: b.assetNo,
      dbNo: b.dbNo,
      contactPhone: b.contactPhone,
      isBorrowed: active.length > 0,
      currentStudent: primary
        ? {
            studentId: primary.student.studentId,
            name: primary.student.name,
            assignedAt: primary.assignedAt,
          }
        : null,
      coBorrowers,
      teamMembers: coBorrowers.map((c) => c.name),
      allBorrowers: active.map((a) => ({ studentId: a.student.studentId, name: a.student.name })),
    };
  });

  return Response.json({ boards: data, students });
});

export const POST = withAuth(async (request: Request) => {
  await requireStaff();
  const body = await request.json();
  const { action } = body;

  // --- create single board ---
  if (action === "create") {
    const { assetNo, dbNo, contactPhone } = body;
    if (!assetNo?.trim() || !dbNo?.trim()) {
      return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }
    const existing = await prisma.board.findFirst({
      where: { OR: [{ assetNo: assetNo.trim() }, { dbNo: dbNo.trim() }] },
    });
    if (existing) return Response.json({ error: "BOARD_EXISTS" }, { status: 409 });

    const board = await prisma.board.create({
      data: { assetNo: assetNo.trim(), dbNo: dbNo.trim(), contactPhone: contactPhone?.trim() || null },
    });
    return Response.json({ board });
  }

  // --- batch create ---
  if (action === "batch_create") {
    const { boards } = body;
    if (!Array.isArray(boards) || boards.length === 0) {
      return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }
    const created = [];
    const skipped: string[] = [];
    for (const item of boards) {
      const assetNo = item.assetNo?.toString().trim();
      const dbNo = item.dbNo?.toString().trim();
      if (!assetNo || !dbNo) {
        skipped.push(`${assetNo ?? "?"}/${dbNo ?? "?"}`);
        continue;
      }
      const existing = await prisma.board.findFirst({ where: { OR: [{ assetNo }, { dbNo }] } });
      if (existing) {
        skipped.push(`${assetNo}/${dbNo}`);
        continue;
      }
      created.push(
        await prisma.board.create({
          data: { assetNo, dbNo, contactPhone: item.contactPhone?.toString().trim() || null },
        }),
      );
    }
    return Response.json({ createdCount: created.length, created, skipped });
  }

  // --- assign board ---
  const { studentId, dbNo, contactPhone, coStudents } = body;
  if (!studentId || !dbNo) return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });

  const board = await prisma.board.findFirst({
    where: { OR: [{ dbNo: dbNo.trim() }, { assetNo: dbNo.trim() }] },
  });
  if (!board) return Response.json({ error: "BOARD_NOT_FOUND" }, { status: 404 });

  if (contactPhone !== undefined) {
    await prisma.board.update({
      where: { id: board.id },
      data: { contactPhone: contactPhone?.trim() || null },
    });
  }

  const inputs: string[] = [studentId.trim()];
  if (Array.isArray(coStudents)) {
    for (const cs of coStudents) {
      if (typeof cs === "string" && cs.trim()) inputs.push(cs.trim());
      else if (cs?.studentId) inputs.push(cs.studentId.trim());
    }
  } else if (typeof coStudents === "string" && coStudents.trim()) {
    inputs.push(...coStudents.split(/[,;\s\n\t]+/).filter(Boolean));
  }

  const resolved: { id: string; name: string; studentId: string }[] = [];
  const missing: string[] = [];
  for (const input of new Set(inputs)) {
    const student = await prisma.user.findFirst({
      where: { role: "STUDENT", OR: [{ studentId: input }, { name: input }, { id: input }] },
    });
    if (student && !resolved.some((s) => s.id === student.id)) resolved.push(student);
    else if (!student) missing.push(input);
  }
  if (missing.length > 0) {
    return Response.json({ error: "STUDENTS_NOT_FOUND", missing }, { status: 400 });
  }

  await prisma.boardAssignment.updateMany({
    where: { boardId: board.id, isReturned: false },
    data: { isReturned: true, returnedAt: new Date() },
  });

  const now = new Date();
  for (const st of resolved) {
    await prisma.boardAssignment.upsert({
      where: { boardId_studentId: { boardId: board.id, studentId: st.id } },
      update: { isReturned: false, assignedAt: now, returnedAt: null },
      create: { boardId: board.id, studentId: st.id, isReturned: false, assignedAt: now },
    });
  }

  const names = resolved.map((s) => `${s.name} (${s.studentId})`).join(", ");
  await notifyDingTalk(
    `[开发板借出登记] 板号 ${board.dbNo} (资产号: ${board.assetNo}) 已借出给: ${names}；联系电话: ${contactPhone || board.contactPhone || "未登记"}`,
  );

  return Response.json({ board, students: resolved });
});

export const PUT = withAuth(async (request: Request) => {
  await requireStaff();
  const { dbNo } = await request.json();
  if (!dbNo) return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });

  const board = await prisma.board.findFirst({
    where: { OR: [{ dbNo: dbNo.trim() }, { assetNo: dbNo.trim() }] },
  });
  if (!board) return Response.json({ error: "BOARD_NOT_FOUND" }, { status: 404 });

  const active = await prisma.boardAssignment.findMany({
    where: { boardId: board.id, isReturned: false },
    include: { student: true },
  });
  if (active.length === 0) {
    return Response.json(
      { error: "NOT_BORROWED", board: { dbNo: board.dbNo, assetNo: board.assetNo } },
      { status: 400 },
    );
  }

  const now = new Date();
  await prisma.boardAssignment.updateMany({
    where: { boardId: board.id, isReturned: false },
    data: { isReturned: true, returnedAt: now },
  });

  const remainingCount = await prisma.boardAssignment.count({ where: { isReturned: false } });
  const students = active.map((a) => ({ name: a.student.name, studentId: a.student.studentId }));

  await notifyDingTalk(
    `[开发板归还登记] 板号 ${board.dbNo} (资产号: ${board.assetNo}) 已由 ${students.map((s) => `${s.name}(${s.studentId})`).join(", ")} 归还。剩余未还: ${remainingCount} 块。`,
  );

  return Response.json({
    board: { id: board.id, dbNo: board.dbNo, assetNo: board.assetNo },
    students,
    returnedAt: now,
    remainingCount,
  });
});

export const DELETE = withAuth(async (request: Request) => {
  await requireStaff();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const dbNo = searchParams.get("dbNo");
  if (!id && !dbNo) return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });

  const board = await prisma.board.findFirst({
    where: { OR: [...(id ? [{ id }] : []), ...(dbNo ? [{ dbNo }] : [])] },
    include: { assignments: { where: { isReturned: false } } },
  });
  if (!board) return Response.json({ error: "BOARD_NOT_FOUND" }, { status: 404 });
  if (board.assignments.length > 0) {
    return Response.json({ error: "BOARD_STILL_BORROWED" }, { status: 400 });
  }

  await prisma.boardAssignment.deleteMany({ where: { boardId: board.id } });
  await prisma.board.delete({ where: { id: board.id } });
  return Response.json({ ok: true });
});
